---
title: "How to check that PHP is really patched for PHP2Shell when the version number does not change"
description: "Backported PHP2Shell fixes keep the old PHP version, so php -v proves nothing. Three checks with real output: the fix marker in the binary, the processes still running the old binary, and the reload that fixes them."
pubDatetime: 2026-10-23T18:00:00+07:00
draft: true
tags: ["php", "security", "linux"]
audience: "Sysadmins who run PHP 7.4, 8.0 or 8.1 from a distro, a backport repository or their own build, and must prove the PHP2Shell fix is in the binary that serves requests"
readerQuestions:
  - "I run PHP 7.4.33 from a backport repository. php -v still says 7.4.33. How do I know if I have the PHP2Shell fix?"
  - "Does this guide apply to me if I run PHP 7.3, PHP 5.6, or PHP on Windows?"
  - "I upgraded the package. How do I check that the PHP process serving my site is not still the old, vulnerable binary?"
  - "Do I need to restart PHP-FPM, or is systemctl reload enough to load the patched binary?"
  - "My PHP runs in Docker containers based on the official php:7.4 image. What do I do?"
  - "The check finds the fix marker. Does that mean my server is no longer vulnerable?"
---

<!-- DRAFT NOTES
- Output in this post is real, from 23 October 2026: a throwaway ubuntu:22.04 container (--cap-add SYS_PTRACE) with php8.1-fpm 8.1.2-1ubuntu2 upgraded to 8.1.2-1ubuntu2.28. Transcript: plans/reports/evidence-261023-1753-php2shell-ubuntu-jammy-before-after-transcript.txt in the workspace. Marker results for Docker php:8.4.26/8.4.27, Ubuntu 24.04 php8.3 and sury php7.4 come from the research run the same day.
- Research reports: plans/reports/research-261023-1643-php2shell-verify-method-and-scale.md, research-261023-1643-php2shell-vendor-patch-status.md.
- Not tested: Apache mod_php reload, LiteSpeed, FrankenPHP static, Windows, RPM changelogs.
- Owner: confirm the first-person wording ("I ran") is fine.
-->

On 21 October 2026 PHP disclosed two critical remote code execution flaws, called PHP2Shell: [CVE-2026-109618](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w) and [CVE-2026-109619](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp). php.net released fixes only for 8.2.35, 8.3.36, 8.4.27 and 8.5.12. Everyone on 7.4, 8.0 or 8.1 gets a backport from their distro or repository, and a backport keeps the PHP version: a fixed sury build still says 7.4.33, and a fixed Ubuntu 22.04 build still says 8.1.2, with only the package revision after it changed.

So `php -v` and version scanners cannot tell you if you are safe. The binary can. Below are three checks, each with the real output I got on 23 October 2026 from one Ubuntu 22.04 server with `php8.1-fpm`, before and after the fix.

## Table of contents

## Does this guide apply to you?

- **PHP 7.4, 8.0, 8.1 and 8.2 to 8.5 on Linux:** yes.
- **PHP 7.3 and older, 5.x:** steps 2 and 3 apply. Upstream has no fix for these, so each vendor writes its own patch, and the marker in step 1 can be missing on a patched build. Check that your package changelog names the CVEs instead, for example `zcat /usr/share/doc/php5.6-fpm/changelog.Debian.gz | grep CVE-2026-10961`.
- **PHP on Windows:** not covered. Nothing here was tested on Windows.

## 1. Check the binary for the fix marker

The fix adds strings to PHP that no earlier version contains. Two kinds of fix exist:

| Fix                                                                                                                                    | Marker strings                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Full fix (8.2 and newer, and distros that ship it, such as Ubuntu 24.04's 8.3.6)                                                       | `memory_hard_limit_percent` and `Hard memory limit of %zu bytes exhausted` |
| EOL backport ([php-src branches](https://github.com/php/php-src/commit/712e60f9edfd03f0960fc4fc3c2c375f42b90aa2) for 7.4, 8.0 and 8.1) | `zend_mm_safe_error_ex` or `Fatal error: %s in %s on line %d`              |

Save this as `check-php-binary.sh`:

```sh
#!/bin/sh
# check-php-binary.sh FILE — prints full-fix, eol-backport or NONE
FILE=${1:?usage: check-php-binary.sh /path/to/php-fpm-or-libphp}
if grep -aqF 'memory_hard_limit_percent' "$FILE" &&
   grep -aqF 'Hard memory limit of %zu bytes exhausted' "$FILE"; then
  echo "full-fix"
elif grep -aqF 'zend_mm_safe_error_ex' "$FILE" ||
     grep -aqF 'Fatal error: %s in %s on line %d' "$FILE"; then
  echo "eol-backport"
else
  echo "NONE"
fi
```

Run it on the binary your **website** uses, not the CLI: `php-fpm*`, Apache's `libphp*.so`, or `lsphp`. They come from different packages. The strings survive `strip`, and `grep -a` needs no extra tools.

Before the fix, the server said 8.1.2 and had no marker:

```text
# php-fpm8.1 -v | head -1
PHP 8.1.2 (fpm-fcgi) (built: Apr  7 2022 17:46:26)
# sh check-php-binary.sh /usr/sbin/php-fpm8.1
NONE
```

After `apt-get install --only-upgrade php8.1-fpm`, the PHP version is still 8.1.2, and the marker is there:

```text
# dpkg-query -W php8.1-fpm
php8.1-fpm	8.1.2-1ubuntu2.28
# sh check-php-binary.sh /usr/sbin/php-fpm8.1
eol-backport
```

The same check gave `full-fix` on Docker `php:8.4.27` and Ubuntu 24.04 `8.3.6-0ubuntu0.24.04.13`, `eol-backport` on sury `7.4.33-31`, and `NONE` on Docker `php:8.4.26`.

If you see `NONE` on a package from another vendor, look for the CVE IDs in its changelog as described above. A vendor's own patch can use different code.

## 2. Check the processes that are running now

The package is fixed. The site is not. Upgrading replaces the file on disk, but a process that started earlier keeps running the old code. Linux marks this with `(deleted)` in `/proc/PID/exe` and `/proc/PID/maps`.

This script checks every running PHP process. It reads the code each process actually loaded, even when the file was deleted. Run it as root on the host. Root in a container usually lacks `CAP_SYS_PTRACE` and cannot read worker processes.

```bash
#!/bin/bash
# check-php-procs.sh — run as root
set -uo pipefail
markers() {
  if ! head -c 4 "$1" >/dev/null 2>&1; then echo "UNREADABLE(run as root on the host)"; return; fi
  if grep -aqF 'memory_hard_limit_percent' "$1" && grep -aqF 'Hard memory limit of %zu bytes exhausted' "$1"; then echo "full-fix"
  elif grep -aqF 'zend_mm_safe_error_ex' "$1" || grep -aqF 'Fatal error: %s in %s on line %d' "$1"; then echo "eol-backport"
  else echo "NONE"; fi
}
for d in /proc/[0-9]*; do
  pid=${d#/proc/}
  comm=$(cat "$d/comm" 2>/dev/null) || continue
  case "$comm" in php*|httpd*|apache2*|frankenphp*|lsphp*|litespeed*) ;; *) continue ;; esac
  exe=$(readlink "$d/exe" 2>/dev/null) || exe="?"
  mnt=$(readlink "$d/ns/mnt" 2>/dev/null)
  if [ -z "$mnt" ]; then ns="?"; elif [ "$mnt" = "$(readlink /proc/self/ns/mnt)" ]; then ns="host"; else ns="other-mnt-ns(container?)"; fi
  echo "PID $pid comm=$comm ns=$ns"
  case "$comm" in
    httpd*|apache2*|litespeed*) echo "  exe: $exe  (web server; PHP is in the lib lines below)" ;;
    *) echo "  exe: $exe  markers=$(markers "$d/exe")" ;;
  esac
  awk '$6 ~ /libphp|mod_php|php[0-9.]*\.so/ && $2 ~ /x/ {print $1, $6, $7}' "$d/maps" 2>/dev/null | sort -u |
  while read -r range path deleted; do
    echo "  lib: $path ${deleted:-}  markers=$(markers "$d/map_files/$range")"
  done
done
```

Right after the upgrade, every FPM process still ran the old, deleted binary. This is the moment `dpkg` and `php -v` already show the fixed package:

```text
# bash check-php-procs.sh
PID 6491 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1 (deleted)  markers=NONE
PID 6492 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1 (deleted)  markers=NONE
PID 6493 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1 (deleted)  markers=NONE
```

`(deleted)` means: reload or restart (step 3). For Apache with mod_php, read the `lib:` lines. `ns=other-mnt-ns(container?)` marks a process inside a container.

## 3. Reload PHP-FPM, restart Apache

For PHP-FPM a reload is enough. On `SIGUSR2` the FPM master re-executes its own binary ([php-fpm(8)](https://github.com/php/php-src/blob/PHP-8.4/sapi/fpm/php-fpm.8.in)), and that is what `systemctl reload` sends:

```text
# grep ExecReload /lib/systemd/system/php8.1-fpm.service
ExecReload=/bin/kill -USR2 $MAINPID
```

```sh
systemctl reload php8.1-fpm   # php7.4-fpm, php8.3-fpm, … for your version
```

After the reload, the same check:

```text
# bash check-php-procs.sh
PID 12856 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1  markers=eol-backport
PID 12857 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1  markers=eol-backport
PID 12858 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1  markers=eol-backport
```

No `(deleted)`, and every process has the marker. Now the site is fixed. (The PIDs changed because this test started FPM as a daemon; under systemd the master keeps its PID.)

For Apache with mod_php, run `systemctl restart apache2` (or `httpd`). It is not verified that a graceful reload loads the new `libphp`. Then run the check again.

## Docker: the official php:7.4, 8.0 and 8.1 images are not patched

The [docker-library/php](https://github.com/docker-library/php) images for 7.4, 8.0 and 8.1 were not rebuilt for PHP2Shell, and they build PHP from source, so `apt upgrade` cannot fix them. An upgrade through `docker exec` is also lost when the container is recreated.

1. Move the base to `php:8.2-fpm` or newer, or build from a distro image with a fixed package. To stay on 7.4, install `php7.4-fpm` from [ondrej/sury](https://packages.sury.org/php/README.txt) on `debian:12-slim`. I built that image on 23 October 2026, and step 1 reported `eol-backport` on `/usr/sbin/php-fpm7.4`.
2. Rebuild the image and recreate the container.
3. Run `check-php-procs.sh` as root on the Docker host. It also sees processes inside containers.

## What a marker does not prove

A marker proves that the official fix code is in the binary. It does not prove the server cannot be exploited. The EOL backport is a "minimal mitigation", not the full fix of 8.2 and newer. The [CVE-2026-109619 advisory](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp) also says: "It might be prudent to set `session.upload_progress.enabled=0` if you don't need this feature even after applying the patch". A backport buys time; the lasting fix is PHP 8.2 or newer.
