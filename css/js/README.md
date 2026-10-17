# EduCore School Management Portal

EduCore is a starter school-management portal built with HTML, CSS, and JavaScript.

## Features

- Dashboard overview
- Student registration and directory
- Student search and deletion
- Attendance recording
- Examination result entry
- Automatic grade calculation
- School announcements
- School profile settings
- Example subscription plans
- Responsive layout for desktop and mobile
- Browser-based demo data storage

## Project Structure

educore-school-portal/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
└── README.md

## How to Run

1. Create the project folders and files.
2. Paste each code section into its corresponding file.
3. Open index.html in a modern browser.
4. Add a student and test the other modules.

You can also open the project folder in Visual Studio Code and
use a local development server extension.

## Data Storage

This starter version uses browser localStorage.

This means:
- Data is saved in the current browser.
- Different devices do not share data.
- Clearing browser storage can remove the records.
- There is no user login or server-side database.
- Browser storage is not suitable for confidential school records.

## Hosting

You can publish the static demo on GitHub Pages.

For a real school-management service, add:
- A secure backend/API
- A production database
- Authentication and role-based permissions
- Server-side validation
- Backups and audit logs
- Secure file storage
- Payment gateway integration for subscriptions
- Privacy and data-protection safeguards

GitHub Pages only hosts the static website files. It does not run
the backend needed for a multi-school subscription service.

## Subscription Notice

The prices shown in the portal are examples. Selecting a plan
does not activate a paid subscription or charge a customer.

Live subscription billing requires a backend and payment provider.

## Project Status

Starter demonstration — not production-ready.
