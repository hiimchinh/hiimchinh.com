---
title: "How to check that PHP is really patched for PHP2Shell when the version number does not change"
description: "A backported PHP2Shell fix keeps the old PHP version, so php -v proves nothing. Grep the binary for a string only the fix adds, then check that no running PHP process still uses the old, deleted binary."
pubDatetime: 2026-10-28T10:51:00+07:00
tags: ["php", "security", "linux"]
audience: "Sysadmins who run PHP 7.4, 8.0 or 8.1 from a distro, a backport repository or their own build, and must prove the PHP2Shell fix is in the binary that serves requests"
readerQuestions:
  - "I run PHP 7.4.33 from a backport repository. php -v still says 7.4.33. How do I know if I have the PHP2Shell fix?"
  - "Does this guide apply to me if I run PHP 7.3, PHP 5.6, or PHP on Windows?"
  - "I upgraded the package. How do I check that the PHP process serving my site is not still the old, vulnerable binary?"
  - "Do I need to restart PHP-FPM, or is systemctl reload enough to load the patched binary?"
  - "My PHP runs in Docker containers based on the official php:7.4 image. What do I do?"
  - "The check finds the fix marker. Does that mean my server is no longer vulnerable?"
readerCheck:
  date: 2026-10-28
  full: 6
  total: 6
factCheck:
  date: 2026-10-28
  claims: 36
  verified: 36
---

A backported PHP2Shell fix keeps the old PHP version, so `php -v` cannot tell you if you are safe. Grep the binary for a string only the fix adds, then check that no running PHP process still uses the old, deleted binary.

On 21 October 2026 PHP disclosed two remote code execution flaws, called PHP2Shell: [CVE-2026-109618](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w) and [CVE-2026-109619](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp). php.net released fixes for 8.2.35, 8.3.36, 8.4.27 and 8.5.12 only. For 7.4, 8.0 and 8.1 the fix comes as a backport from your distro, and the PHP version stays the same: a fixed Ubuntu 22.04 build still says 8.1.2, with only the package revision after it changed.

The output below comes from a throwaway Ubuntu 22.04 container with `php8.1-fpm`, run on 28 October 2026, before and after the fix.

## Does this guide apply to you?

- **PHP 7.4 to 8.5 on Linux:** yes.
- **PHP 7.3, 5.x:** steps 2 and 3 only. Upstream has no fix there, so a vendor patch may lack the marker. Look for the CVE IDs in the package changelog instead: `zcat /usr/share/doc/php5.6-fpm/changelog.Debian.gz | grep -E 'CVE-2026-10961(8|9)'`.
- **PHP on Windows:** not covered, not tested.

## 1. Check the binary for the fix marker

| Fix                                                                                                                                                           | Marker strings                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Full fix (8.2.35 and newer)                                                                                                                                   | `memory_hard_limit_percent` and `Hard memory limit of %zu bytes exhausted` |
| EOL backport for 7.4, 8.0, 8.1 ([7.4 commit](https://github.com/php/php-src/commit/712e60f9edfd03f0960fc4fc3c2c375f42b90aa2); 8.0 and 8.1 have matching ones) | `zend_mm_safe_error_ex` or `Fatal error: %s in %s on line %d`              |

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

Run it on the binary your website uses (`php-fpm*` or Apache's `libphp*.so`), not the CLI. They come from different packages.

Before the fix:

```text
# php-fpm8.1 -v | head -1
PHP 8.1.2 (fpm-fcgi) (built: Apr  7 2022 17:46:26)
# sh check-php-binary.sh /usr/sbin/php-fpm8.1
NONE
```

After `apt-get install --only-upgrade php8.1-fpm`:

```text
# dpkg-query -W php8.1-fpm
php8.1-fpm	8.1.2-1ubuntu2.28
# sh check-php-binary.sh /usr/sbin/php-fpm8.1
eol-backport
```

## 2. Check the processes that are running now

Upgrading replaces the file on disk. A process that started earlier keeps running the old code, and Linux marks it `(deleted)` in `/proc/PID/exe`. This script reads the code each PHP process actually loaded. Run it as root on the host.

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

Right after the upgrade, when `dpkg` already showed the fixed package:

```text
# bash check-php-procs.sh
PID 6920 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1 (deleted)  markers=NONE
PID 6921 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1 (deleted)  markers=NONE
PID 6922 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1 (deleted)  markers=NONE
```

`(deleted)` means the site still runs the vulnerable code. For mod_php, read the `lib:` lines.

## 3. Reload PHP-FPM, restart Apache

For PHP-FPM a reload is enough: on `SIGUSR2` the master reloads its binary ([php-fpm(8)](https://github.com/php/php-src/blob/PHP-8.4/sapi/fpm/php-fpm.8.in)), and `systemctl reload` sends exactly that:

```text
# grep ExecReload /lib/systemd/system/php8.1-fpm.service
ExecReload=/bin/kill -USR2 $MAINPID
```

After `systemctl reload php8.1-fpm` (the test sent `SIGUSR2` directly):

```text
# bash check-php-procs.sh
PID 13075 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1  markers=eol-backport
PID 13076 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1  markers=eol-backport
PID 13077 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1  markers=eol-backport
```

No `(deleted)`, and every process has the marker. For Apache with mod_php, run `systemctl restart apache2`. In a test, `apachectl graceful` kept the old, deleted `libphp`. Then check again.

## Docker images

The official [docker-library/php](https://github.com/docker-library/php) images for 7.4, 8.0 and 8.1 build PHP from source and are no longer maintained, so `apt upgrade` cannot fix them. Move to `php:8.2-fpm` or newer, rebuild, recreate the container, and run `check-php-procs.sh` on the Docker host. It also sees processes inside containers (`ns=other-mnt-ns(container?)`).

## What a marker does not prove

A marker proves the official fix code is in the binary. The EOL backport is a "minimal mitigation", not the full fix. The [CVE-2026-109619 advisory](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp) adds: "It might be prudent to set `session.upload_progress.enabled=0` if you don't need this feature even after applying the patch". The lasting fix is PHP 8.2 or newer.
