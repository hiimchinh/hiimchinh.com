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
readerCheck:
  date: 2026-10-23
  full: 6
  total: 6
---

<!-- DRAFT NOTES
- Sources accessed 23 October 2026. The checks were run on 23 October 2026 against real packages: official Docker php:8.4.26 and php:8.4.27, Ubuntu noble php8.3 8.3.6-0ubuntu0.24.04.13, Ubuntu jammy php8.1 8.1.2-1ubuntu2 and 8.1.2-1ubuntu2.28, sury php7.4 7.4.33-31+0~20261021.121. Not tested: Apache mod_php reload, LiteSpeed, FrankenPHP static builds, Windows, RPM changelogs.
- Research reports (workspace): plans/reports/research-261023-1643-php2shell-verify-method-and-scale.md and research-261023-1643-php2shell-vendor-patch-status.md.
- The Apache sample output in step 4 is illustrative: the lib: path handling was tested with a simulated mapping, not a real Apache + libphp.
- Worked example transcript (real output, 23/10/2026, throwaway ubuntu:22.04 container with --cap-add SYS_PTRACE): plans/reports/evidence-261023-1753-php2shell-ubuntu-jammy-before-after-transcript.txt in the workspace. Only the shell prompt and blank lines were tidied.
- Owner: confirm the first-person wording in the intro ("I checked") is fine, or change it to neutral.
-->

On 21 October 2026 PHP disclosed two critical remote code execution flaws, together called PHP2Shell: [CVE-2026-109618](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w) and [CVE-2026-109619](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp). Fixed releases exist only for 8.2 to 8.5: 8.2.35, 8.3.36, 8.4.27 and 8.5.12.

If you run anything older, your fix is a backport. Ubuntu, Red Hat, Freexian (paid Debian 11 support), ondrej (sury), Remi, cPanel and Plesk patch PHP 7.4, 8.0 or 8.1 **without changing the upstream version number**. A patched sury build still says 7.4.33. A patched Ubuntu 22.04 says `8.1.2-1ubuntu2.28`: the package revision changes, but the PHP version is still 8.1.2. So a scanner or an `X-Powered-By` check that reads the PHP version sees the same number before and after, and `php -v` at best tells you the package revision, not whether the binary that serves requests has the fix.

What you can check is the binary itself. The fix adds new error strings and new exported functions to PHP. They are in the file even when it is stripped. I checked the commands below on 23 October 2026 against real packages before and after the fix. The [worked example](#worked-example-one-server-before-and-after-the-fix) near the end shows every check on one server, with the real output, before and after the upgrade.

## Table of contents

## Does this guide apply to you?

It applies when you run PHP on **Linux** and you want to know if the PHP2Shell fix from php-src is in the binary that is serving requests. That covers distro packages, backport repositories, panel builds and your own builds.

| Your setup                                                         | What this guide does for you                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PHP 8.2 to 8.5 from any source                                     | The check finds the "full fix" marker.                                                                                                                                                                                                                                                                    |
| PHP 7.4, 8.0 or 8.1 with a fixed package from the table below      | The check finds the "EOL backport" marker on Ubuntu 22.04 php8.1 and ondrej/sury php7.4, which were tested. The other vendors' builds were not tested; if one reports `NONE`, use the changelog check at the end of step 2.                                                                               |
| PHP 7.3 or older, PHP 5.x (including Ubuntu Pro php7.2 and php7.0) | Partly. Upstream has no fix for these, so each vendor writes its own patch. The marker check was not tested on these builds and can report `NONE` on a patched build. Use the changelog check at the end of step 2, then plan an upgrade. Steps 4 to 6 (running processes, reload, Docker) apply in full. |
| PHP on Windows                                                     | Not covered. The commands here were not tested on Windows.                                                                                                                                                                                                                                                |
| A shared host where you have no shell                              | Not covered. Ask the host for the package version and compare it with the table below.                                                                                                                                                                                                                    |

A marker proves that the fix code is in the binary. It does **not** prove the server is no longer exploitable. See [What a marker does not prove](#what-a-marker-does-not-prove).

## Where the patched packages come from

Use this table to find the version you should have. Only the vendors' own pages were used, accessed 23 October 2026.

| Platform                                               | Fixed package                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Cost                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Debian 12 / 13                                         | php8.2 `8.2.35-1~deb12u1` ([DLA-4848-1](https://www.debian.org/lts/security/2026/dla-4848)), php8.4 `8.4.27-1~deb13u1` ([DSA-6574-1](https://www.debian.org/security/2026/dsa-6574))                                                                                                                                                                                                                                                                                                                                             | Free                           |
| Debian 11, php7.4                                      | **No free fix** yet: `7.4.33-1+deb11u12` is still vulnerable ([tracker](https://security-tracker.debian.org/tracker/CVE-2026-109618)). Freexian ELTS has `7.4.33-1+deb11u14` ([tracker](https://deb.freexian.com/extended-lts/tracker/CVE-2026-109618))                                                                                                                                                                                                                                                                          | Paid                           |
| Ubuntu 22.04                                           | php8.1 `8.1.2-1ubuntu2.28` ([USN-8948-1](https://ubuntu.com/security/notices/USN-8948-1))                                                                                                                                                                                                                                                                                                                                                                                                                                        | Free                           |
| Ubuntu 24.04                                           | php8.3 `8.3.6-0ubuntu0.24.04.13` ([USN-8948-1](https://ubuntu.com/security/notices/USN-8948-1))                                                                                                                                                                                                                                                                                                                                                                                                                                  | Free                           |
| Ubuntu 20.04 / 18.04 / 16.04                           | php7.4 `7.4.3-4ubuntu2.29+esm5`, php7.2 `7.2.24-0ubuntu0.18.04.17+esm14`, php7.0 `7.0.33-0ubuntu0.16.04.16+esm22` ([USN-8948-2](https://ubuntu.com/security/notices/USN-8948-2))                                                                                                                                                                                                                                                                                                                                                 | Ubuntu Pro                     |
| ondrej PPA / packages.sury.org                         | `1:7.4.33-31`, `1:8.0.30-25`, `8.1.34-9` ([changelog](https://launchpad.net/~ondrej/+archive/ubuntu/php/+sourcepub/18891785/+files/changelog))                                                                                                                                                                                                                                                                                                                                                                                   | Free                           |
| Remi (EL9)                                             | php74 `7.4.33-31`, php80 `8.0.30-21`, php81 `8.1.34-6` ([repo](https://rpms.remirepo.net/enterprise/9/php74/x86_64/))                                                                                                                                                                                                                                                                                                                                                                                                            | Free                           |
| RHEL 8 php:7.4                                         | `php-7.4.33-8.module+el8.10.0+25117+30337cca` ([RHSA-2026:87080](https://access.redhat.com/errata/RHSA-2026:87080)). Same fix in AlmaLinux ([ALSA-2026:87080](https://errata.almalinux.org/8/ALSA-2026-87080.html)) and Rocky ([RLSA-2026:87080](https://errata.rockylinux.org/RLSA-2026:87080))                                                                                                                                                                                                                                 | RHEL paid, Alma and Rocky free |
| RHEL 8 php:7.2, 7.3, 8.0 streams                       | No advisory found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | —                              |
| cPanel EasyApache 4                                    | ea-php74, ea-php80, ea-php81 backports in 25.91 ([change log](https://docs.cpanel.net/changelogs/easyapache-4-change-log-25/))                                                                                                                                                                                                                                                                                                                                                                                                   | With licence                   |
| Plesk (Linux)                                          | Backports for 7.4.33, 8.0.30, 8.1.34; version string unchanged ([change log](https://docs.plesk.com/release-notes/obsidian/change-log/))                                                                                                                                                                                                                                                                                                                                                                                         | With licence                   |
| PHP 7.3 and older, 5.x                                 | Ubuntu Pro (php7.2, php7.0, php5 on 14.04, [USN-8948-2](https://ubuntu.com/security/notices/USN-8948-2)); CloudLinux alt-php 5.2 to 5.6 and 7.0 to 7.4 ([announcement](https://blog.cloudlinux.com/php-cve-2026-109618-and-cve-2026-109619)); TuxCare ELS ([FAQ](https://tuxcare.com/els-php2shell-patches-faq/)); DirectAdmin CustomBuild patches for 5.6 and 7.0 to 7.4, applied on rebuild ([forum, staff posts](https://forum.directadmin.com/threads/critical-php-updates.82726/page-9)). Each uses its own port of the fix | Mostly paid                    |
| Official Docker images `php:7.4`, `php:8.0`, `php:8.1` | **Not rebuilt.** The [docker-library/php](https://github.com/docker-library/php) repository only builds 8.2 and newer                                                                                                                                                                                                                                                                                                                                                                                                            | —                              |

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

Run it on the binary from step 1:

```sh
sh check-php-binary.sh /usr/sbin/php-fpm7.4
```

Expected output: `full-fix`, `eol-backport` or `NONE`. A count over the php-src source trees found none of these strings in 7.4, 8.0, 8.1, 8.2.34 or 8.4.26 before the fix, so an unfixed build gives `NONE`. These are the results on real packages:

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
apt changelog php7.2-fpm | grep -E 'CVE-2026-10961(8|9)'    # Debian, Ubuntu (downloads the changelog)
zcat /usr/share/doc/php7.2-fpm/changelog.Debian.gz | grep -E 'CVE-2026-10961(8|9)'  # same, offline
rpm -q --changelog php-fpm | grep -E 'CVE-2026-10961(8|9)'  # RHEL family (not tested)
```

Expected output: at least one line naming `CVE-2026-109618` or `CVE-2026-109619`. No output means the vendor did not record the fix in that package.

Replace `php7.2-fpm` with the package that owns your binary. To find that package for any PHP version, including 5.6 and panel builds installed as packages:

```sh
dpkg -S "$(readlink -f "$FILE")"   # Debian, Ubuntu: prints the package name
rpm -qf "$FILE"                    # RHEL family, CloudLinux
```

Expected output: the package name, for example `php8.1-fpm: /usr/sbin/php-fpm8.1`.

## 3. Optional: confirm the behaviour with a safe local probe

The fix changes what PHP does when it runs out of memory. This probe makes the CLI use too much memory **in its own process**. It is not an exploit: it sends no request and touches no session or upload code.

Run it with the CLI binary from the same build, for example `/usr/bin/php7.4` next to `php-fpm7.4`, or `/usr/local/bin/php` in the official images. The probe tests that CLI file, not the FPM or Apache binary, so use step 2 or step 4 for those. Do not run it inside a production FPM pool.

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

With the probe exactly as written above:

| Build        | Expected output                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| Not fixed    | `Fatal error: Allowed memory size of 10485760 bytes exhausted …`, then `shutdown function ran`, `exit=255` |
| Full fix     | `Hard memory limit of 20971520 bytes exhausted …`, no shutdown line, `exit=137`                            |
| EOL backport | `Fatal error: Allowed memory size …` on stderr, no shutdown line, `exit=1`                                 |

The exit codes come from the code paths. 255 is PHP's normal exit after a fatal error, and the shutdown function still runs. The full fix stops the process at once with `_exit(137)` when memory passes the hard limit (twice `memory_limit` here). The EOL backport stops it at once with `_exit(1)`. Here 137 is an exit code that PHP sets itself. Do not confuse it with the 137 that a shell or Docker reports when the kernel's out-of-memory killer kills a process (128 + signal 9). In both fixed cases no PHP code runs after the out-of-memory error.

Keep the string interpolation on the `$b` line. With one big `str_repeat()` the fixed 8.4.27 build still answers `exit=255`, because that call takes a path that fails softly.

On 8.2 and newer there is a shorter check: `php -n -r 'var_dump(ini_get("memory_hard_limit_percent"));'` prints `bool(false)` before the fix and `string(0) ""` after it. EOL backports add no new setting, so on 7.4, 8.0 and 8.1 it prints `bool(false)` in both cases. Do not use it there.

## 4. Check the processes that are running now

Upgrading the package replaces the file on disk. A process that started before the upgrade keeps running the old code. Linux shows this as `(deleted)` after the path in `/proc/PID/exe` and `/proc/PID/maps`.

This script checks every running PHP process, including the ones in containers. It reads the file each process actually loaded through `/proc/PID/exe` and `/proc/PID/map_files/`, so it also works when that file was deleted. Run it as root on the host. Worker processes run as another user (for example `www-data`), and reading them needs `CAP_SYS_PTRACE`. Root on a normal host has it; root inside a container usually does not, and the script then prints `UNREADABLE`. Since Linux 5.9, reading `map_files` needs `CAP_SYS_ADMIN` or `CAP_CHECKPOINT_RESTORE` ([proc_pid_map_files(5)](https://man7.org/linux/man-pages/man5/proc_pid_map_files.5.html)).

```bash
#!/bin/bash
# check-php-procs.sh — run as root
set -uo pipefail
markers() {
  if ! head -c 4 "$1" >/dev/null 2>&1; then echo "UNREADABLE(run as root; needs CAP_SYS_PTRACE)"; return; fi
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

On a server that is fixed and restarted, the output looks like this (your PIDs and paths will differ):

```text
PID 812 comm=php-fpm8.3 ns=host
  exe: /usr/sbin/php-fpm8.3  markers=full-fix
```

For Apache with mod_php, the PHP code is in `libphp*.so`, so the check reads the `lib:` lines and skips the Apache binary itself. The output looks like this (illustrative: this path was tested with a simulated library mapping, not with a real Apache):

```text
PID 1033 comm=apache2 ns=host
  exe: /usr/sbin/apache2  (web server; PHP is in the lib lines below)
  lib: /usr/lib/apache2/modules/libphp7.4.so   markers=eol-backport
```

What the results mean:

- `markers=NONE` with no `(deleted)`: the file on disk has no official fix code. On 7.4 and newer, upgrade the package. On 7.3 and older, or with a vendor's own patch, use the changelog check from step 2 before you decide.
- `exe: … (deleted)` or `lib: … (deleted)`: the process still runs the code from before the upgrade. Reload or restart it (step 5). The marker shown is for the **old** code.
- `ns=other-mnt-ns(container?)`: the process runs in a container. See step 6.

## 5. Reload PHP-FPM, restart Apache

**PHP-FPM:** a reload is enough. On `SIGUSR2` the FPM master runs `execvp()` on its own path, so it loads the new binary ([php-fpm(8)](https://github.com/php/php-src/blob/PHP-8.4/sapi/fpm/php-fpm.8.in): "graceful reload of all workers + reload of fpm conf/binary"). The upstream systemd unit uses exactly that for `reload`. When FPM runs in the foreground, as under systemd (`--nodaemonize`) and in Docker, the master keeps its PID. In a test with the official `php:8.4.26-fpm-alpine` image, the `php-fpm` binary was replaced by the 8.4.27 one while FPM ran, then the master got `SIGUSR2`. After the signal the master kept its PID, lost the `(deleted)` mark and showed the full-fix marker. The new workers showed it too.

```sh
systemctl reload php7.4-fpm   # the unit is named after your version, for example php8.3-fpm
```

The same holds for the Debian package from ondrej/sury. Its `php7.4-fpm.service` has `ExecReload=/bin/kill -USR2 $MAINPID`, so `systemctl reload` sends exactly that signal. In a test with `php7.4-fpm 1:7.4.33-31` on Debian 12, the binary was replaced while FPM ran. Before the signal the master showed `exe: /usr/sbin/php-fpm7.4 (deleted)`. After it, the master had the same PID, `exe: /usr/sbin/php-fpm7.4` without `(deleted)`, and new worker PIDs.

**Apache with mod_php:** restart it. It is not verified that a graceful reload loads the new `libphp`.

```sh
systemctl restart apache2   # httpd on RHEL-family systems
```

Then run `check-php-procs.sh` again. Expected result: no `(deleted)`, and every `markers=` value is `full-fix` or `eol-backport`.

## 6. Docker: rebuild the image, then recreate the container

The official `php:7.4`, `php:8.0` and `php:8.1` images were not rebuilt for PHP2Shell. A container based on them stays unfixed until you change the base.

1. Check the image without running your app. Find the PHP binaries in the image (this needs `sh` in the image; the official images have it):

   ```sh
   docker run --rm --entrypoint sh IMAGE -c \
     'find / \( -name php-fpm -o -name "libphp*.so" -o -name php \) -type f 2>/dev/null'
   ```

   Copy the one your container serves with out of the image, then run the step 2 check on the copy. In the official `-fpm` images it is `/usr/local/sbin/php-fpm`. In the `-apache` images, use the `libphp*.so` path that `find` printed:

   ```sh
   id=$(docker create IMAGE)
   docker cp "$id":/usr/local/sbin/php-fpm /tmp/php-fpm-check
   docker rm "$id"
   sh check-php-binary.sh /tmp/php-fpm-check
   ```

   Expected result for an image based on the official `php:7.4-fpm`: `NONE`.

2. Fix the image. The official images build PHP from source into `/usr/local`, so no package upgrade can patch them. Choose one:
   - Change `FROM php:7.4-fpm` to `FROM php:8.2-fpm` or newer, if your application runs on 8.2.
   - Build on a distro image and install PHP from a fixed package in the table above. To stay on 7.4, this Dockerfile uses the ondrej/sury packages with the setup steps from [packages.sury.org](https://packages.sury.org/php/README.txt):

     ```dockerfile
     FROM debian:12-slim
     RUN apt-get update \
      && apt-get install -y --no-install-recommends lsb-release ca-certificates curl \
      && curl -sSLo /tmp/debsuryorg-archive-keyring.deb https://packages.sury.org/debsuryorg-archive-keyring.deb \
      && dpkg -i /tmp/debsuryorg-archive-keyring.deb \
      && echo "deb [signed-by=/usr/share/keyrings/debsuryorg-archive-keyring.gpg] https://packages.sury.org/php/ $(lsb_release -sc) main" > /etc/apt/sources.list.d/php.list \
      && apt-get update \
      && apt-get install -y --no-install-recommends php7.4-fpm \
      && sed -i 's|^listen = .*|listen = 9000|' /etc/php/7.4/fpm/pool.d/www.conf \
      && mkdir -p /run/php \
      && rm -rf /var/lib/apt/lists/* /tmp/*.deb
     CMD ["php-fpm7.4", "-F"]
     ```

     For an `-apache` image, install `apache2` and `libapache2-mod-php7.4` instead of `php7.4-fpm`, drop the `sed` and `mkdir` lines, and use `CMD ["apache2ctl", "-D", "FOREGROUND"]`. For a CLI-only image, install `php7.4-cli`. These two variants were not built in the test.

     The `-fpm` Dockerfile above was built on 23 October 2026: it installed `php7.4-fpm 1:7.4.33-31+0~20261021.121+debian12~1`, the step 2 check on `/usr/sbin/php-fpm7.4` reported `eol-backport`, and `php-fpm7.4` ran as the container's main process. Add the PHP extensions your application needs (`php7.4-mysql`, `php7.4-gd`, …) to the `apt-get install` line. The official image keeps its configuration in `/usr/local/etc`, this one in `/etc/php/7.4`, so move your settings across.

   Then rebuild the image.

3. Recreate the container from the new image. An `apt upgrade` run through `docker exec` changes only that container's writable layer. It is gone the next time the container is created from the old image.
4. From the host, run `check-php-procs.sh`. To see which container a PID belongs to, read `/proc/PID/cgroup`. On cgroup v2 with systemd it shows `docker-<container id>.scope`.

## Worked example: one server before and after the fix

This is the whole check on one server, with the real output. It ran on 23 October 2026 in a throwaway Ubuntu 22.04 container, started with `--cap-add SYS_PTRACE` so that root could read the worker processes as root on a normal host can.

The server first had `php8.1-fpm 8.1.2-1ubuntu2`, the build Ubuntu 22.04 shipped in April 2022, with FPM running. Then it got the fixed `8.1.2-1ubuntu2.28` from [USN-8948-1](https://ubuntu.com/security/notices/USN-8948-1).

### Before the fix

The version says 8.1.2:

```text
# php-fpm8.1 -v | head -1
PHP 8.1.2 (fpm-fcgi) (built: Apr  7 2022 17:46:26)
```

The binary has no marker (step 2):

```text
# sh check-php-binary.sh /usr/sbin/php-fpm8.1
NONE
```

The probe (step 3) shows the old behaviour: the shutdown function still runs after the out-of-memory error, and the exit code is 255:

```text
# php -n -d memory_limit=10M -d display_errors=stderr /demo/oom-probe.php; echo "exit=$?"
Fatal error: Allowed memory size of 10485760 bytes exhausted (tried to allocate 25165856 bytes) in /demo/oom-probe.php on line 4
shutdown function ran
exit=255
```

The running FPM master and its two workers all run unfixed code (step 4):

```text
# bash check-php-procs.sh
PID 6491 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1  markers=NONE
PID 6492 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1  markers=NONE
PID 6493 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1  markers=NONE
```

### After `apt-get install --only-upgrade php8.1-fpm php8.1-cli`

The package is fixed. The upstream number in the version is still 8.1.2; only the Ubuntu revision after it changed:

```text
# dpkg-query -W php8.1-fpm
php8.1-fpm	8.1.2-1ubuntu2.28
# php -v | head -1
PHP 8.1.2-1ubuntu2.28 (cli) (built: Oct 19 2026 18:54:45) (NTS)
```

The file on disk now has the EOL backport marker:

```text
# sh check-php-binary.sh /usr/sbin/php-fpm8.1
eol-backport
```

But the site is **not** fixed yet. The upgrade did not restart FPM (in the container, apt printed `invoke-rc.d: policy-rc.d denied execution of restart.`), so every process still runs the deleted old binary:

```text
# bash check-php-procs.sh
PID 6491 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1 (deleted)  markers=NONE
PID 6492 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1 (deleted)  markers=NONE
PID 6493 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1 (deleted)  markers=NONE
```

In this state the package, `dpkg` and `php -v` all show the fixed revision, yet every process that serves requests runs the old code.

### After the reload

The unit file shows what `systemctl reload` does:

```text
# grep ExecReload /lib/systemd/system/php8.1-fpm.service
ExecReload=/bin/kill -USR2 $MAINPID
```

The same signal, sent by hand because the container has no systemd, then the check again:

```text
# kill -USR2 "$(cat /run/php/php8.1-fpm.pid)"; sleep 2; bash check-php-procs.sh
PID 12856 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1  markers=eol-backport
PID 12857 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1  markers=eol-backport
PID 12858 comm=php-fpm8.1 ns=host
  exe: /usr/sbin/php-fpm8.1  markers=eol-backport
```

No `(deleted)`, and every process has the marker. Here FPM was started as a daemon, so the reload forked a new master with a new PID. Under systemd the PID stays the same.

The probe now stops at the error, with no shutdown function and exit code 1:

```text
# php -n -d memory_limit=10M -d display_errors=stderr /demo/oom-probe.php; echo "exit=$?"

Fatal error: Allowed memory size of 10485760 bytes exhausted (tried to allocate 25165856 bytes) in /demo/oom-probe.php on line 4
exit=1
```

Ubuntu's changelog names the fix, so on this package the changelog check also works:

```text
# zcat /usr/share/doc/php8.1-fpm/changelog.Debian.gz | grep -E 'CVE-2026-10961(8|9)' | head -3
    - debian/patches/CVE-2026-109618_109619.patch: Avoid state corruption via
    - CVE-2026-109618
    - CVE-2026-109619
```

The order matters: the package check said "fixed" one step before the server really was. Only the process check caught the gap.

## What a marker does not prove

A marker shows that the code from the official fix commit is in the binary. It does not show that the server cannot be exploited:

- The EOL backport is a "minimal mitigation", not the full fix of 8.2 and newer. It also turns off session upload progress, even though `ini_get('session.upload_progress.enabled')` still returns `1`.
- Community backports for 7.3 and older can miss paths. For example, an issue on [vperetti/php-cve-2026-109618-109619-backports](https://github.com/vperetti/php-cve-2026-109618-109619-backports/issues/2) lists fatal error paths that the official 7.4 patch converts but the 7.x and 5.x ports do not.
- The [CVE-2026-109619 advisory](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp) says: "It might be prudent to set `session.upload_progress.enabled=0` if you don't need this feature even after applying the patch". This applies to every build, including the full fix. If you do not use upload progress, set it to `0` in `php.ini` and reload.

A backport buys time. The lasting fix is PHP 8.2 or newer, where the full fix is released.
