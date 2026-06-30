# bot-anti-nuke

บอท Discord สำหรับป้องกันการ **nuke** เซิร์ฟเวอร์ (anti-nuke / anti-raid) เขียนด้วย [discord.js](https://discord.js.org) v14

## ฟีเจอร์

- 🤖 **Anti-bot invite** — เตะ/แบนบอทแปลกที่ถูกเชิญเข้ามา
- 🛡️ **Self-protect** — ป้องกันไม่ให้ใครมาแตะตัวบอทเอง
- 🚨 **Retaliate-on-action** — ตอบโต้ผู้กระทำที่ลงมือ nuke
- 💣 **Anti-nuke threshold + quarantine** — ตรวจจับการกระทำเกิน limit ในช่วงเวลาที่กำหนด แล้วริบสิทธิ์/กักตัว
- ♻️ **Auto-restore** — กู้คืนห้องที่ถูกลบอัตโนมัติ
- 🔴 **Panic-lock (lockdown)** — ล็อกเซิร์ฟเวอร์อัตโนมัติเมื่อเจอการโจมตี
- ⌨️ **คำสั่งจัดการ** — `!status`, `!lock`, `!unlock`, `!backup`, `!restore`, `!help`

## การติดตั้ง

```bash
npm install
```

## ตั้งค่า

1. คัดลอก `.env.example` เป็น `.env`
2. ใส่ `DISCORD_TOKEN` และค่าต่าง ๆ ตามต้องการ

```bash
cp .env.example .env
```

## รัน

```bash
node index.js
```

## หมายเหตุด้านความปลอดภัย

- ไฟล์ `.env` ถูก ignore ไว้แล้ว — **ห้าม** commit token ขึ้น repo
- ต้องเปิด **Server Members Intent** และ **Message Content Intent** ใน Discord Developer Portal
