---
title: "File Permissions in Linux/Unix: How to translate them?"
description: "In this tutorial, I'll show you how I learn to translate file permissions in Linux."
pubDatetime: 2021-05-01T00:00:00+07:00
tags: ["linux"]
---

## The four numbers

If you want to use `chmod` to change the permission of a file or directory. You just need to remember that:

- 0: no permission
- 1: execute
- 2: write
- 4: read

## Adding them up

With this you can add up the permission you want to change. For example:

- 7 means 1 + 2 + 4 which is all the permission
- 6 means 2 + 4 which is only write and read

And now you don't have to remember all the number again.
