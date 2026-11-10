---
title: "My coding agent ran sudo netplan under umask 077 and took my build server offline for four hours"
description: "On 14 September 2026 my agent regenerated Netplan from a service with UMask=0077. sudo kept that umask, the .network file came out mode 0600, systemd-networkd could not read it and dropped the DHCP lease. One sudoers line now forces umask 0022 for netplan."
pubDatetime: 2026-11-11T07:00:00+07:00
draft: true
tags: ["ai-agents", "linux", "netplan", "sudo", "incident"]
stance: "Fix the cause once instead of patching the symptom again."
audience: "Engineers who let a coding agent run sudo on a Linux server that uses Netplan and systemd-networkd"
readerQuestions:
  - "Why did my server lose its network after netplan generate and networkctl reload?"
  - "Why does a file created through sudo get mode 0600?"
  - "How do I stop an agent's umask from breaking Netplan?"
  - "Does this apply to me if my agent never runs sudo, or my server uses NetworkManager?"
  - "How do I check that networkd can read the Netplan output?"
factCheck:
  date: 2026-11-11
  claims: 24
  verified: 21
  owner: 3
---

<!-- DRAFT NOTES
Claims to confirm (only you can):
1. 14 Sep: you told the agent "giải quyết tận gốc vụ ssh đi" (fix the SSH problem at the root).
2. 14 Sep 22:42: you allowed the soft reboot that brought the server back.
-->

On 14 September 2026 my coding agent ran `sudo netplan generate` from a service with `UMask=0077`, and my build server lost its network for four hours. One sudoers line now forces umask 0022 for `netplan`; a reproduction shows the file mode go from 0600 to 0640.

## Does this apply to you?

- **An agent or service with a strict umask runs `sudo netplan`** on a host with systemd-networkd: yes.
- **The agent runs netplan as root with a strict umask, no sudo:** yes, and the sudoers rule below does not cover it. Set umask 0022 in that script.
- **Nothing with a strict umask writes your network config:** no.
- **NetworkManager instead of networkd:** not tested. Check which user reads the generated files, then run the check at the end as that user.

## What happened

SSH from the build server to a remote server hung at key exchange. I told the agent to fix it at the root. Probes showed packets near 1,500 bytes were lost on that path: MSS 1,440 passed, 1,452 timed out. Changing key-exchange algorithms would only have dodged the large packet, so it added a route with MTU 1480. Then it applied the route. Times from the systemd journal, +07:

- **18:39:42** `sudo /usr/sbin/netplan generate`, run by the agent's service.
- **18:39:43** `networkctl reload`. systemd-networkd logged `Permission denied` on `/run/systemd/network/10-netplan-eth0.network`, then `Unmanaging interface` and `DHCP lease lost`.
- **18:40:45** Tailscale last saw the host.
- **22:42** I allowed a soft reboot; the new boot got its DHCP lease back.

The hosting console showed the server running. Neither SSH nor Tailscale could reach it.

## Root cause

The agent's service runs with `UMask=0077` to keep its files private. By default sudo does not lower the caller's umask. From `man sudoers`:

> If umask_override is not set, sudo will set the umask to be the union of the user's umask and what is specified in sudoers.

So Netplan wrote the `.network` file as mode 0600, owner root, group systemd-network. The networkd daemon runs as user systemd-network and needs the group read bit. Reload made it drop the interface it could not read.

## The fix

One file, `/etc/sudoers.d/netplan-umask`, installed by Ansible with mode 0440 and checked with `visudo`:

```sudoers
Defaults!/usr/sbin/netplan umask=0022,umask_override
```

It sets umask 0022 whatever the caller's umask is, so no agent's service needs to change. The provisioning code also stopped reloading networkd for a route change. It checks the file as user systemd-network, then applies the one route with `ip route replace`.

A reproduction writes only into a temporary `--root-dir` and never touches the live network. Each case generates config for a test interface, then checks the file as networkd's user:

```bash
dir=$(mktemp -d)   # plus etc/netplan/99-test.yaml and a 755 run/systemd/network
(umask 077; sudo env netplan generate --root-dir "$dir")   # sudo, rule does not match
(umask 077; sudo netplan generate --root-dir "$dir")       # sudo, rule matches
sudo stat -c '%a %U:%G' "$dir/run/systemd/network/10-netplan-eth9.network"
sudo -u systemd-network test -r "$dir/run/systemd/network/10-netplan-eth9.network"
```

```console
$ ./repro-umask.sh
root shell, umask 077 (guard bypassed): 600 root:systemd-network readable-by-systemd-network=no
sudo env netplan, umask 077 (rule does not match): 600 root:systemd-network readable-by-systemd-network=no
sudo netplan from umask 077 caller: 640 root:systemd-network readable-by-systemd-network=yes
root shell, umask 022: 640 root:systemd-network readable-by-systemd-network=yes
```

Lines 2 and 3 are the before and after. Lines 1 and 2 are the limit of the fix: the rule matches only a direct `sudo netplan`. A root shell or `sudo sh -c` runs netplan outside it, so the Ansible task runs `umask 0022` itself before `netplan generate`.

## The cost

Four hours without SSH or Tailscale, from 18:39 to 22:42. No agent job on the server could be controlled remotely in that time.

## Check your own server

```console
$ sudo -u systemd-network test -r /run/systemd/network/10-netplan-eth0.network && echo readable
readable
$ sudo stat -c '%a %U:%G' /run/systemd/network/10-netplan-eth0.network
640 root:systemd-network
```

Change `eth0` to your interface. Run this before `networkctl reload`, never after.

The fix for the SSH problem was right; applying it broke something else. Fix the cause once instead of patching the symptom again. The umask is the cause, so the guard sits on `netplan`, not on one agent.
