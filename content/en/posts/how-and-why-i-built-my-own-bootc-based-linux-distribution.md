---
title: How and Why I Built My Own bootc-Based Linux Distribution
date: 2026-09-20T16:00:00Z
author: SpaceShaman
description: How I built SpaceOS on top of Fedora and bootc and installed it alongside Debian on an encrypted drive.
tags: [linux, bootc, fedora, spaceos, displaylink]
translationKey: spaceos-bootc-distribution
showToc: true
---

What an adventure it has been 🤠

It all started with yet another attempt to configure NixOS as a replacement for Debian, which I use every day.

I really like the idea behind NixOS: declarative configuration of the entire system and the ability to reproduce an environment both sound great. Unfortunately, in practice, it turned out to be much harder than I had expected. I find the Nix language completely unintuitive, the documentation can be maddening at times, and conflicting advice on best practices is scattered all over the internet. Or maybe I am just not smart enough to figure it out? Hard to say XD. In any case, somewhere around my third attempt to configure NixOS—and yet another failure—I started looking for an alternative. That was when I discovered bootc.

As soon as I started reading the [bootc documentation](https://bootc.dev/bootc/), I was blown away. An entire operating system described in a `Containerfile` and built like a regular container image, with updates and rollbacks powered by OSTree. Beautiful. Of course, this is not NixOS with different syntax, and it does not promise exactly the same things. But it gave me what mattered most: I could keep the recipe for my system in a repository and use it to build subsequent versions without manually recreating everything after every installation.

I quickly got to work configuring my dream distro. I am a minimalist by nature, so the feature-packed images prepared by [Universal Blue](https://universal-blue.org/) were not an option. I wanted to decide for myself what went into the system. I chose the official `quay.io/fedora/fedora-bootc` image, which provides a Fedora base prepared to run through bootc: the kernel, essential system tools, and the image update mechanism. It is not a ready-made desktop loaded with applications, so I could add everything else myself. Fedora maintains the base, and for each rebuild I can use its current version instead of assembling the system from scratch by hand.

Of course, I am not crazy enough to switch immediately to a new system before it is ready for my day-to-day work.

At first, I decided to build and run SpaceOS in a virtual machine. I built the image with Podman, converted it to a `qcow2` disk with `bootc-image-builder`, and then ran it in QEMU. This let me prepare the basic configuration and check whether the system booted at all. It soon became clear, however, that building a new VM disk after every change—or working inside the VM and running `bootc switch` there—was rather slow and frustrating. A VM also cannot tell me everything about my computer: it is not an easy way to test my Wi-Fi adapter, docking station, or DisplayLink-connected monitors.

So I decided to install the new system alongside Debian on the physical drive.

That was where things became a little tricky. I am somewhat paranoid and like to keep my data encrypted with LUKS. At first, I tried installing the system through Anaconda, but my partition layout made the process increasingly unpleasant. I also had the idea of letting Debian and SpaceOS share a single GRUB installation. I managed to get the system to boot, but after rebuilding the SpaceOS image, Debian's GRUB entry did not keep up with the new OSTree deployments. That made rollback—supposed to be one of the greatest advantages of the whole exercise—inconvenient.

In the end, I put the two systems on separate LVM logical volumes inside the same LUKS container. Each system got its own `/boot` and `/boot/efi` partitions outside the encrypted container and its own UEFI boot entry. This allows bootc to manage its own GRUB installation and the entries for successive system versions, while at startup I choose either Debian or SpaceOS in UEFI. They share data encryption, not the boot mechanism.

## How I Installed It

If you are mainly interested in the story of the project, feel free to skip this section. What follows describes the layout I used on my machine, not a universal recipe for every drive.

Partitioning operations are inherently dangerous, so I recommend making a backup first. Unless you enjoy an adrenaline rush and are not afraid of losing files 😉

My drive is laid out like this:

```text
p1  Debian /boot/efi       FAT32
p2  Debian /boot           ext4
p3  shared LUKS container
    └── LVM volume group
        ├── Debian /        ext4
        ├── swap
        └── SpaceOS /       ext4
p4  SpaceOS /boot          ext4
p5  SpaceOS /boot/efi      FAT32
```

First, I made room at the end of the drive. I booted from a SystemRescue USB drive so I would not have to shrink the filesystem from which Debian was currently running. After unlocking LUKS and activating LVM, I checked Debian's unmounted filesystem and shrank it, then adjusted the sizes of the LVM and LUKS partitions. This part must be adapted to your own layout: order matters, and copying someone else's sector numbers from the internet is a bad idea, even if they belong to a very likable blog author. Before making any changes, I inspected `lsblk`, `pvs`, `vgs`, `lvs`, and the GPT partition table. After every operation, I made sure Debian still booted correctly.

From the space I had freed, I created two small partitions outside LUKS: about 1 GiB for `/boot` and about 1 GiB for the SpaceOS EFI partition. I added the remaining space back to the LUKS partition, expanded the LVM physical volume inside it using `pvresize`, and created a new logical volume named `spaceos`. This gave me around 58 GiB for the system. I formatted that volume and `/boot` as `ext4`, and the EFI partition as FAT32. This way, the SpaceOS root filesystem is encrypted together with Debian, while both systems have independent boot files.

After expanding and unlocking the LUKS partition, the part inside LVM looked roughly like this on my machine:

```bash
sudo pvresize /dev/mapper/nvme0n1p3_crypt
sudo lvcreate -L 58G -n spaceos ton618-vg
sudo mkfs.ext4 -L SPACEOS_ROOT /dev/ton618-vg/spaceos
sudo mkfs.ext4 -L SPACEOS_BOOT /dev/nvme0n1p4
sudo mkfs.fat -F32 -n SPACEOS_EFI /dev/nvme0n1p5
```

These are the device names from my computer. The three formatting commands in particular will erase the contents of the filesystems they target, so check that the partition numbers are correct before using them.

Next, I mounted the future root filesystem at `/mnt/spaceos`, the boot partition at `/mnt/spaceos/boot`, and the EFI partition at `/mnt/spaceos/boot/efi`. It is worth running `findmnt` for all three paths at this point. If any of them points to the wrong filesystem, this is definitely not the time to launch the installer.

```bash
sudo mkdir -p /mnt/spaceos
sudo mount /dev/ton618-vg/spaceos /mnt/spaceos
sudo mkdir -p /mnt/spaceos/boot
sudo mount /dev/nvme0n1p4 /mnt/spaceos/boot
sudo mkdir -p /mnt/spaceos/boot/efi
sudo mount /dev/nvme0n1p5 /mnt/spaceos/boot/efi
findmnt /mnt/spaceos
findmnt /mnt/spaceos/boot
findmnt /mnt/spaceos/boot/efi
```

I build the image locally with `podman build`. I do not publish it to a registry yet, so I installed from the local `localhost/spaceos:latest` image by running `bootc install to-filesystem` from within it. This method assumes that the filesystems have already been prepared and mounted; bootc should not have to guess how I wanted to partition the drive. I provided the UUIDs for `/` and `/boot`, and passed the UUID of the LUKS container and the name of the LVM volume as kernel arguments. Without the latter two, the system would not know what to unlock during startup. My script looks like this, except that I have replaced my own identifiers with placeholders for yours:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Use blkid to find the filesystem UUIDs and cryptsetup luksUUID to find
# the LUKS container UUID. Set LVM_LV to the group and volume names.
ROOT_UUID="ENTER_ROOT_FILESYSTEM_UUID"
BOOT_UUID="ENTER_BOOT_PARTITION_UUID"
LUKS_UUID="ENTER_LUKS_CONTAINER_UUID"
LVM_LV="ENTER_GROUP_NAME/VOLUME_NAME"

for value in "$ROOT_UUID" "$BOOT_UUID" "$LUKS_UUID" "$LVM_LV"; do
  if [[ "$value" == ENTER_* ]]; then
    echo "Fill in the UUIDs and the LVM volume name first." >&2
    exit 1
  fi
done

sudo podman run --rm --privileged \
  --pid=host \
  --ipc=host \
  --security-opt label=type:unconfined_t \
  -v /dev:/dev \
  -v /var/lib/containers:/var/lib/containers \
  -v /mnt/spaceos:/target \
  localhost/spaceos:latest \
  bootc install to-filesystem \
    --bootloader=grub \
    --root-mount-spec="UUID=${ROOT_UUID}" \
    --boot-mount-spec="UUID=${BOOT_UUID}" \
    --karg="rd.luks.uuid=${LUKS_UUID}" \
    --karg="rd.lvm.lv=${LVM_LV}" \
    /target
```

Before running it, replace the placeholder values, verify that the filesystems are mounted under `/mnt/spaceos`, and make sure the image is available to the instance of Podman launched through `sudo`.

There was one more catch—this time, a bootc bug. With two EFI partitions on the same drive, `bootc install to-filesystem` could select the first one, belonging to Debian, even though I had mounted the SpaceOS EFI partition under the target directory. [The issue has also been reported in the bootc repository](https://github.com/bootc-dev/bootc/issues/1929). For the duration of the installation, I therefore unmounted Debian's EFI partition and temporarily changed its **GPT type** from “EFI System” to a regular Linux partition. I did not format it or remove any files. After the installation, I restored the correct type and mounted it again. This works around a specific partition-selection problem, but it is also a step where confusing the partition numbers can cause serious trouble.

Finally, I used `efibootmgr -v` to verify that the SpaceOS entry actually pointed to its own EFI partition. Only then did I decide I could breathe again. After my earlier adventures with GRUB, I preferred evidence over a good feeling.

## Developing the System from Within

This was when the fun part of the whole operation began. With SpaceOS correctly installed alongside my main system, I could develop it from within SpaceOS itself. I edit the `Containerfile`, build a new image locally, and switch the system to it with `bootc switch --transport containers-storage localhost/spaceos:latest`. After a restart, the new deployment boots; if I break something, I can return to the previous one. This is exactly the kind of workflow that made me interested in bootc.

Installing software and preparing configuration here resembles building a regular container. I currently use Fedora 44 as the base, with Sway, `greetd` and `tuigreet`, Fish, Alacritty, and a handful of tools I find indispensable. The repository also contains scripts for building a VM image and an installation ISO. The project is still evolving, so this list is by no means a sacred declaration of packages for all eternity.

I also came up with the idea of copying the repository to `/etc/spaceos` during the build and creating symbolic links to its configuration files. This lets me edit the configuration in one place and immediately see the changes in programs that read it dynamically. Moreover, uncommitted local changes under `/etc` do not disappear simply because the system switches to a new image. This does not mean bootc transfers my files into the image, however: Podman uses the current contents of the project directory during the build, while OSTree separately carries local `/etc` changes over to the new version during deployment. If I edit something on the running system, I need to remember whether I want to keep it locally only or commit it to the repository as well.

That distinction matters. `/usr` and most of the system come from the image and are replaced with new contents when the version changes. `/etc` remains writable by default and persists across updates, with local changes taken into account. Symbolic links to `/etc/spaceos` therefore make sense for my experiment, although they require some care: if I modify a file locally, a new version of the same file from the image may not overwrite my edit. `/var`, meanwhile, holds data that should survive both system switches and rollbacks. The [bootc documentation](https://bootc.dev/bootc/filesystem.html) explains these rules in much greater detail.

## DisplayLink, Because of Course It Couldn't Be That Easy

The DisplayLink drivers for my docking station proved to be one of the bigger problems. Adding an RPM package to the image looked innocent enough. But then I still had to build the EVDI module for the exact kernel included in the image, start the user-space component, and get Sway to cooperate with the additional displays. My first attempts produced the classic “almost works” symptom: the image built successfully, but after login Sway immediately kicked me back to `greetd`.

At first, I tried installing an unofficial DisplayLink RPM and building EVDI with DKMS while assembling the image. The module build itself could finish successfully, which unfortunately did not mean that the graphical session would start on the physical machine. On top of that, `bootc container lint` warned about files left behind by DKMS and other installation steps. So I began treating the module build and DisplayLink's operation on the hardware as separate problems.

In the end, I studied how [Universal Blue](https://github.com/ublue-os/akmods) uses `akmods` and adapted the idea to my own `Containerfile`, without switching to one of its ready-made images. In a separate build stage, I install the compilation tools and the `kernel-devel` package matching the kernel from `fedora-bootc`, build EVDI, verify that the module was actually produced, and copy the resulting package together with the user-space part of DisplayLink into the final image. This means the compilers and the entire build toolchain do not have to remain in the target system.

I get the packages from the [Fedora Multimedia repository maintained by Negativo17](https://negativo17.org/), also known as Simone Caronni. If you use Fedora and have ever needed something outside its core repositories, you may already have encountered his work. In my case, the `displaylink`, `libevdi`, and `akmod-evdi` packages available there saved me from a great deal of additional manual tinkering. A small nod of appreciation to him, because without people like that, our “it's just one driver” projects would be far less fun.

The current `Containerfile` builds EVDI in a separate stage and installs it in the SpaceOS image. I also had to change the command that launches Sway in `greetd`, adding the `--unsupported-gpu` flag. I tested the image on the physical computer, and this time DisplayLink works with the docking station while Sway no longer sends me back to `greetd`. Finally 😄

## Updates Managed by CI/CD

Once the system became suitable for everyday use, building images locally was no longer enough. It is convenient while working on the configuration, but it is hardly a sensible way to publish subsequent system versions. I also did not want to remember to rebuild SpaceOS manually every time Fedora updated the base image. It was time for GitHub Actions and GHCR.

An official release now begins with a tag following the `v0.1.3` pattern. The workflow validates its format, builds the SpaceOS image, generates `/etc/os-release` with the correct version number, and publishes everything to GitHub Container Registry. The immutable version tag remains in the registry permanently, while the `stable`, `latest`, and `auto` tags are moved to the newly released image. This means that someone following the `auto` channel receives not only Fedora fixes, but new SpaceOS releases as well.

The same tag triggers a build of the Anaconda installation ISO. The finished image and its SHA-256 checksum are attached to a new GitHub Release. A system installed from this ISO follows the `auto` tag from the start, so it does not have to be switched manually to the update channel after installation. The ISO is built only for proper releases. There is no point in producing another installer just because a few packages changed in Fedora's base image.

A second workflow handles exactly those changes. Once a week, it checks the digest of the `fedora-bootc:44` image and compares it with the base used by the most recently published SpaceOS image. If Fedora has changed nothing, the action finishes without building anything. If the digest is new, the workflow checks out the latest release, rebuilds the image, and publishes it under a tag containing the SpaceOS version, the date, and part of the base digest—for example, `auto-v0.1.3-20260920-abcdef123456`. The `auto` tag is moved to that image, and I retain the five most recent automatic rebuilds in the registry. Images carrying release tags are not subject to this cleanup.

The remaining question was what to do on the running system. bootc's default automatic update mechanism did not suit the way I work, because I do not want my computer deciding to restart at the least convenient moment. Instead, I added my own systemd timer. Every hour, it checks the update channel and, provided the connection is not metered, the battery is not too low, and the machine is not under heavy load, downloads and stages a new deployment in the background. It does not restart the computer. Waybar tells me that an update is waiting, and the new version starts only the next time I reboot the machine myself.

## Summary

SpaceOS began with the frustration of yet another attempt at NixOS and ended up as a system whose entire recipe I can keep in Git, test like a container image, and update without manually recreating my environment. I had to overcome many problems along the way, but in the end I succeeded. Those very problems ultimately gave me a much better understanding of bootc, OSTree, the process of building a custom operating system, and many other Linux-related topics.

The project's code is available in the [SpaceOS repository on GitHub](https://github.com/SpaceShaman/spaceos). Its README contains a more detailed description of the system itself, the installation process, published tags, update mechanism, included software, and keyboard shortcuts.

I should emphasize that SpaceOS is a system built specifically for me, my hardware, and the way I work. I would not really recommend installing it directly as your own operating system. Instead, I encourage you to fork the repository and treat it as a starting point for building your own unique distribution. After all, the greatest advantage of this approach is precisely that the system can truly be yours.
