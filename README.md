# NetDiag — AI-Powered Network Diagnostic Assistant

> Live Demo: https://network-diagnostic-delta.vercel.app

An AI-powered full-stack web application that diagnoses network problems using Claude AI. Built with Lebanon's telecom infrastructure in mind (Ogero, MTC Touch, Alfa).

---

## Features

- AI network diagnosis with severity classification (LOW / MEDIUM / HIGH)
- User authentication with ban enforcement and rate limiting (20 msg/day)
- Admin dashboard with 6 tabs: Overview, Users, Conversations, Tickets, Locations, Speed Tests
- Support ticket system with email notifications
- Built-in speed test (download / upload / ping / jitter)
- Location-based ISP detection (Ogero / MTC Touch / Alfa)
- User analytics with 19+ data points per user
- Multi-language support: English, Arabic (RTL), French
- PDF export of diagnostic reports
- Mobile responsive with dark/light mode

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind CSS v4 |
| Backend | Vercel Serverless Functions (Node.js) |
| AI | Claude API (Anthropic) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Email | Resend API |
| Deployment | Vercel |

---

## Screenshots

<img width="937" height="964" alt="image" src="https://github.com/user-attachments/assets/451a383c-8296-4b70-b060-0c4a27fa948f" />

<img width="376" height="564" alt="image" src="https://github.com/user-attachments/assets/28683a14-68a9-4255-9ace-ab1f1d862369" />

<img width="985" height="981" alt="image" src="https://github.com/user-attachments/assets/32fd1717-d83a-4c27-a1f6-f7542240a18c" />




---

## Local Setup

```bash
git clone https://github.com/engineerchadibeyrouty/network-diagnostic
cd network-diagnostic
npm install
```

Create a `.env` file:
