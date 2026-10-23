---
title: "How to check that PHP is really patched for PHP2Shell when the version number does not change"
description: "Backported PHP2Shell fixes keep the old version string, so php -v proves nothing. Check the binary that actually serves requests for the strings the fix adds, find processes still running a deleted old binary, and know which result means what."
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
- Sources accessed 23 October 2026. The checks were run on 23 October 2026 against real packages: official Docker php:8.4.26 and php:8.4.27, Ubuntu noble php8.3 8.3.6-0ubuntu0.24.04.13, Ubuntu jammy php8.1 8.1.2-1ubuntu2 and 8.1.2-1ubuntu2.28, sury php7.4 7.4.33-31+0~20261021.121. Not tested: Apache mod_php reload, LiteSpeed, FrankenPHP static builds, Windows, RPM changelogs.
- Research reports (workspace): plans/reports/research-261023-1643-php2shell-verify-method-and-scale.md and research-261023-1643-php2shell-vendor-patch-status.md.
- Owner: confirm the first-person wording in the intro ("I checked") is fine, or change it to neutral.
-->

On 21 October 2026 PHP disclosed two critical remote code execution flaws, together called PHP2Shell: [CVE-2026-109618](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w) and [CVE-2026-109619](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp). Fixed releases exist only for 8.2 to 8.5: 8.2.35, 8.3.36, 8.4.27 and 8.5.12.

If you run anything older, your fix is a backport. Ubuntu, Red Hat, Freexian (paid Debian 11 support), ondrej (sury), Remi, cPanel and Plesk patch PHP 7.4, 8.0 or 8.1 **without changing the version number**. A patched Ubuntu 24.04 still says 8.3.6. A patched sury build still says 7.4.33. So `php -v`, the `X-Powered-By` header and most scanners cannot tell you whether you are safe.

What you can check is the binary itself. The fix adds new error strings and new exported functions to PHP. They are in the file even when it is stripped. I checked the commands below on 23 October 2026 against real packages before and after the fix.

## Table of contents

## Does this guide apply to you?

It applies when you run PHP on **Linux** and you want to know if the PHP2Shell fix from php-src is in the binary that is serving requests. That covers distro packages, backport repositories, panel builds and your own builds.

| Your setup                                                                                                             | What this guide does for you                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PHP 8.2 to 8.5 from any source                                                                                         | The check finds the "full fix" marker.                                                                                                                                                                                                                                                                    |
| PHP 7.4, 8.0 or 8.1 patched from the php-src backport branches (the distro and repository packages in the table below) | The check finds the "EOL backport" marker.                                                                                                                                                                                                                                                                |
| PHP 7.3 or older, PHP 5.x (including Ubuntu Pro php7.2 and php7.0)                                                     | Partly. Upstream has no fix for these, so each vendor writes its own patch. The marker check was not tested on these builds and can report `NONE` on a patched build. Use the changelog check at the end of step 2, then plan an upgrade. Steps 4 to 6 (running processes, reload, Docker) apply in full. |
| PHP on Windows                                                                                                         | Not covered. The commands here were not tested on Windows.                                                                                                                                                                                                                                                |
| A shared host where you have no shell                                                                                  | Not covered. Ask the host for the package version and compare it with the table below.                                                                                                                                                                                                                    |

A marker proves that the fix code is in the binary. It does **not** prove the server is no longer exploitable. See [What a marker does not prove](#what-a-marker-does-not-prove).

## Where the patched packages come from

Use this table to find the version you should have. Only the vendors' own pages were used, accessed 23 October 2026.

| Platform                                               | Fixed package                                                                                                                                                                                                                                                                                    | Cost                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Debian 12 / 13                                         | php8.2 `8.2.35-1~deb12u1` ([DLA-4848-1](https://www.debian.org/lts/security/2026/dla-4848)), php8.4 `8.4.27-1~deb13u1` ([DSA-6574-1](https://www.debian.org/security/2026/dsa-6574))                                                                                                             | Free                           |
| Debian 11, php7.4                                      | **No free fix** yet: `7.4.33-1+deb11u12` is still vulnerable ([tracker](https://security-tracker.debian.org/tracker/CVE-2026-109618)). Freexian ELTS has `7.4.33-1+deb11u14` ([tracker](https://deb.freexian.com/extended-lts/tracker/CVE-2026-109618))                                          | Paid                           |
| Ubuntu 22.04 / 24.04                                   | php8.1 `8.1.2-1ubuntu2.28`, php8.3 `8.3.6-0ubuntu0.24.04.13` ([USN-8948-1](https://ubuntu.com/security/notices/USN-8948-1))                                                                                                                                                                      | Free                           |
| Ubuntu 20.04 / 18.04 / 16.04                           | php7.4 `7.4.3-4ubuntu2.29+esm5`, php7.2 `7.2.24-0ubuntu0.18.04.17+esm14`, php7.0 `7.0.33-0ubuntu0.16.04.16+esm22` ([USN-8948-2](https://ubuntu.com/security/notices/USN-8948-2))                                                                                                                 | Ubuntu Pro                     |
| ondrej PPA / packages.sury.org                         | `1:7.4.33-31`, `1:8.0.30-25`, `8.1.34-9` ([changelog](https://launchpad.net/~ondrej/+archive/ubuntu/php/+sourcepub/18891785/+files/changelog))                                                                                                                                                   | Free                           |
| Remi (EL9)                                             | php74 `7.4.33-31`, php80 `8.0.30-21`, php81 `8.1.34-6` ([repo](https://rpms.remirepo.net/enterprise/9/php74/x86_64/))                                                                                                                                                                            | Free                           |
| RHEL 8 php:7.4                                         | `php-7.4.33-8.module+el8.10.0+25117+30337cca` ([RHSA-2026:87080](https://access.redhat.com/errata/RHSA-2026:87080)). Same fix in AlmaLinux ([ALSA-2026:87080](https://errata.almalinux.org/8/ALSA-2026-87080.html)) and Rocky ([RLSA-2026:87080](https://errata.rockylinux.org/RLSA-2026:87080)) | RHEL paid, Alma and Rocky free |
| RHEL 8 php:7.2, 7.3, 8.0 streams                       | No advisory found                                                                                                                                                                                                                                                                                | —                              |
| cPanel EasyApache 4                                    | ea-php74, ea-php80, ea-php81 backports in 25.91 ([change log](https://docs.cpanel.net/changelogs/easyapache-4-change-log-25/))                                                                                                                                                                   | With licence                   |
| Plesk (Linux)                                          | Backports for 7.4.33, 8.0.30, 8.1.34; version string unchanged ([change log](https://docs.plesk.com/release-notes/obsidian/change-log/))                                                                                                                                                         | With licence                   |
| Official Docker images `php:7.4`, `php:8.0`, `php:8.1` | **Not rebuilt.** The [docker-library/php](https://github.com/docker-library/php) repository only builds 8.2 and newer                                                                                                                                                                            | —                              |

Paid long-term support vendors (TuxCare, Zend, HeroDevs, Freexian PHP LTS) say they ship fixes for older branches. They did not publish exact package versions. Run the marker check below; if it reports `NONE`, ask the vendor which fix their build contains.

## 1. Find the PHP binary that actually serves requests

`php -v` runs the **CLI** binary. Your website runs a different one: `php-fpm`, Apache's `libphp*.so` or `mod_php*.so`, `lsphp` or `frankenphp`. They come from different packages and can have different versions.

List the candidates on disk:

```sh
ls -l /usr/sbin/php-fpm* /usr/local/sbin/php-fpm* /usr/lib/apache2/modules/libphp*.so \
  /usr/lib64/httpd/modules/libphp*.so /usr/local/bin/php 2>/dev/null
```

Check the one your web server uses. Step 4 shows how to find it from the running process.

## 2. Check the binary for the fix marker

The fix adds strings and exported functions that do not exist in any PHP source before the fix. Two kinds of fix exist, and each one leaves its own marker:

| Fix                                                                                                                                                                                                                                                                                                                      | Released in                                                               | Marker strings in the binary                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Full fix                                                                                                                                                                                                                                                                                                                 | 8.2.35, 8.3.36, 8.4.27, 8.5.12                                            | `memory_hard_limit_percent` and `Hard memory limit of %zu bytes exhausted` |
| EOL backport ("Minimal mitigation for EOL version", [7.4](https://github.com/php/php-src/commit/712e60f9edfd03f0960fc4fc3c2c375f42b90aa2), [8.0](https://github.com/php/php-src/commit/82f8f31b16a035c1b67cc253e79f7cc288f4cc20), [8.1](https://github.com/php/php-src/commit/1d7dec178a094e6e75b229ce22754045f8c6070a)) | Packages built from the `PHP-7.4/8.0/8.1-CVE-2026-109618-109619` branches | `zend_mm_safe_error_ex`, or `Fatal error: %s in %s on line %d`             |

`grep -a` reads the binary as text. It needs no extra tools, so it also works inside slim Docker images:

```sh
FILE=/usr/sbin/php-fpm7.4   # the binary from step 1, for example php-fpm8.3 or libphp7.4.so

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

Expected output: `full-fix`, `eol-backport` or `NONE`. These are the results on real packages:

| Package                                                   | `php -v` shows    | Result         |
| --------------------------------------------------------- | ----------------- | -------------- |
| Docker `php:8.4.26`                                       | 8.4.26            | `NONE`         |
| Docker `php:8.4.27`                                       | 8.4.27            | `full-fix`     |
| Ubuntu 24.04 php8.3-cli `8.3.6-0ubuntu0.24.04.13`         | 8.3.6             | `full-fix`     |
| Ubuntu 22.04 php8.1-cli `8.1.2-1ubuntu2` (before the fix) | 8.1.2             | `NONE`         |
| Ubuntu 22.04 php8.1-cli `8.1.2-1ubuntu2.28`               | 8.1.2-1ubuntu2.28 | `eol-backport` |
| sury php7.4-cli `7.4.33-31+0~20261021.121`                | 7.4.33            | `eol-backport` |

Stripping does not remove the marker. The strings live in the read-only data section, and the new functions are exported (`ZEND_API`), so they stay in the dynamic symbol table. If you have binutils, this is a second check:

```sh
nm -D --defined-only "$FILE" | grep -E ' (zend_set_memory_hard_limit_percent|zend_mm_safe_error_ex)$'
```

Expected output on a fixed build: one line ending in one of the two names. On the official Docker image, plain `nm` says `no symbols` and `nm -D` still finds them.

`NONE` on a 7.3 or 5.x build, or on a build with a vendor's own patch, does not mean unpatched. Those patches can use different code. For those builds, check that the package changelog names the CVEs. That is the vendor's statement, not proof from the binary:

```sh
apt changelog php7.2-fpm | grep -E 'CVE-2026-10961(8|9)'    # Debian, Ubuntu
rpm -q --changelog php-fpm | grep -E 'CVE-2026-10961(8|9)'  # RHEL family (not tested)
```

Expected output: at least one line naming `CVE-2026-109618` or `CVE-2026-109619`. No output means the vendor did not record the fix in that package.

## 3. Optional: confirm the behaviour with a safe local probe

The fix changes what PHP does when it runs out of memory. This probe makes the CLI use too much memory **in its own process**. It is not an exploit: it sends no request and touches no session or upload code.

Run it with the CLI binary from the same build. Do not run it inside a production FPM pool.

```php
<?php
// oom-probe.php
register_shutdown_function(function () { echo "shutdown function ran\n"; });
$a = str_repeat('a', 6 << 20);
$b = "$a$a$a$a"; // one 24 MiB allocation, more than twice memory_limit
echo "not reached\n";
```

```sh
php -n -d memory_limit=10M -d display_errors=stderr oom-probe.php; echo "exit=$?"
```

| Build        | Expected output                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| Not fixed    | `Fatal error: Allowed memory size of 10485760 bytes exhausted …`, then `shutdown function ran`, `exit=255` |
| Full fix     | `Hard memory limit of 20971520 bytes exhausted …`, no shutdown line, `exit=137`                            |
| EOL backport | `Fatal error: Allowed memory size …` on stderr, no shutdown line, `exit=1`                                 |

The exit codes come from the code paths. 255 is PHP's normal exit after a fatal error, and the shutdown function still runs. The full fix stops the process at once with `_exit(137)` when memory passes the hard limit (twice `memory_limit` here). The EOL backport stops it at once with `_exit(1)`. In both fixed cases no PHP code runs after the out-of-memory error.

Keep the string interpolation on the `$b` line. With one big `str_repeat()` the fixed 8.4.27 build still answers `exit=255`, because that call takes a path that fails softly.

On 8.2 and newer there is a shorter check: `php -n -r 'var_dump(ini_get("memory_hard_limit_percent"));'` prints `bool(false)` before the fix and `string(0) ""` after it. EOL backports add no new setting, so on 7.4, 8.0 and 8.1 it prints `bool(false)` in both cases. Do not use it there.

## 4. Check the processes that are running now

Upgrading the package replaces the file on disk. A process that started before the upgrade keeps running the old code. Linux shows this as `(deleted)` after the path in `/proc/PID/exe` and `/proc/PID/maps`.

This script checks every running PHP process, including the ones in containers. It reads the file each process actually loaded through `/proc/PID/exe` and `/proc/PID/map_files/`, so it also works when that file was deleted. Run it as root. Since Linux 5.9, reading `map_files` needs `CAP_SYS_ADMIN` or `CAP_CHECKPOINT_RESTORE` ([proc_pid_map_files(5)](https://man7.org/linux/man-pages/man5/proc_pid_map_files.5.html)).

```bash
#!/bin/bash
# check-php-procs.sh — run as root
set -uo pipefail
markers() {
  if ! head -c 4 "$1" >/dev/null 2>&1; then echo "UNREADABLE(run as root)"; return; fi
  if grep -aqF 'memory_hard_limit_percent' "$1" && grep -aqF 'Hard memory limit of %zu bytes exhausted' "$1"; then echo "full-fix"
  elif grep -aqF 'zend_mm_safe_error_ex' "$1" || grep -aqF 'Fatal error: %s in %s on line %d' "$1"; then echo "eol-backport"
  else echo "NONE"; fi
}
for d in /proc/[0-9]*; do
  pid=${d#/proc/}
  comm=$(cat "$d/comm" 2>/dev/null) || continue
  case "$comm" in php*|httpd*|apache2*|frankenphp*|lsphp*|litespeed*) ;; *) continue ;; esac
  exe=$(readlink "$d/exe" 2>/dev/null) || exe="?"
  ns="host"; [ "$(readlink "$d/ns/mnt" 2>/dev/null)" != "$(readlink /proc/self/ns/mnt)" ] && ns="other-mnt-ns(container?)"
  echo "PID $pid comm=$comm ns=$ns"
  echo "  exe: $exe  markers=$(markers "$d/exe")"
  awk '$6 ~ /libphp|mod_php|php[0-9.]*\.so/ && $2 ~ /x/ {print $1, $6, $7}' "$d/maps" 2>/dev/null | sort -u |
  while read -r range path deleted; do
    echo "  lib: $path ${deleted:-}  markers=$(markers "$d/map_files/$range")"
  done
done
```

On a server that is fixed and restarted, the output looks like this (your PIDs and paths will differ):

```text
PID 812 comm=php-fpm8.3 ns=host
  exe: /usr/sbin/php-fpm8.3  markers=full-fix
```

What the results mean:

- `markers=NONE` with no `(deleted)`: the file on disk is not fixed. Upgrade the package.
- `exe: … (deleted)` or `lib: … (deleted)`: the process still runs the code from before the upgrade. Reload or restart it (step 5). The marker shown is for the **old** code.
- `ns=other-mnt-ns(container?)`: the process runs in a container. See step 6.

## 5. Reload PHP-FPM, restart Apache

**PHP-FPM:** a reload is enough. On `SIGUSR2` the FPM master runs `execvp()` on its own path, so it loads the new binary ([php-fpm(8)](https://github.com/php/php-src/blob/PHP-8.4/sapi/fpm/php-fpm.8.in): "graceful reload of all workers + reload of fpm conf/binary"). The upstream systemd unit uses exactly that for `reload`. In the test, the master kept its PID, lost the `(deleted)` mark and showed the full-fix marker. The new workers showed it too.

```sh
systemctl reload php7.4-fpm   # the unit is named after your version, for example php8.3-fpm
```

**Apache with mod_php:** restart it. It is not verified that a graceful reload loads the new `libphp`.

```sh
systemctl restart apache2   # httpd on RHEL-family systems
```

Then run `check-php-procs.sh` again. Expected result: no `(deleted)`, and every line shows `full-fix` or `eol-backport`.

## 6. Docker: rebuild the image, then recreate the container

The official `php:7.4`, `php:8.0` and `php:8.1` images were not rebuilt for PHP2Shell. A container based on them stays unfixed until you change the base.

1. Check the image without running your app. Copy the binary your container serves with out of the image, then run the step 2 check on the copy. In the official `-fpm` images it is `/usr/local/sbin/php-fpm`:

   ```sh
   id=$(docker create IMAGE)
   docker cp "$id":/usr/local/sbin/php-fpm /tmp/php-fpm-check
   docker rm "$id"
   FILE=/tmp/php-fpm-check   # then run the step 2 check
   ```

   Expected result for an image based on the official `php:7.4-fpm`: `NONE`.

2. Fix the image: move the base to `php:8.2` or newer, or install PHP from a patched repository from the table above. Rebuild the image.
3. Recreate the container from the new image. An `apt upgrade` run through `docker exec` changes only that container's writable layer. It is gone the next time the container is created from the old image.
4. From the host, run `check-php-procs.sh`. To see which container a PID belongs to, read `/proc/PID/cgroup`. On cgroup v2 with systemd it shows `docker-<container id>.scope`.

## What a marker does not prove

A marker shows that the code from the official fix commit is in the binary. It does not show that the server cannot be exploited:

- The EOL backport is a "minimal mitigation", not the full fix of 8.2 and newer. It also turns off session upload progress, even though `ini_get('session.upload_progress.enabled')` still returns `1`.
- Community backports for 7.3 and older can miss paths. For example, an issue on [vperetti/php-cve-2026-109618-109619-backports](https://github.com/vperetti/php-cve-2026-109618-109619-backports/issues/2) lists fatal error paths that the official 7.4 patch converts but the 7.x and 5.x ports do not.
- The [CVE-2026-109619 advisory](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp) says: "It might be prudent to set `session.upload_progress.enabled=0` if you don't need this feature even after applying the patch". This applies to every build, including the full fix. If you do not use upload progress, set it to `0` in `php.ini` and reload.

The way out of all three is the same: move to PHP 8.2 or newer, where the full fix is released.
