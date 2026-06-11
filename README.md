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

*(Add screenshots here)*

---

## Local Setup

```bash
git clone https://github.com/engineerchadibeyrouty/network-diagnostic
cd network-diagnostic
npm install
```

Create a `.env` file:
