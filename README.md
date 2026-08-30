# LinkedIn Profile API

A reverse-engineered LinkedIn profile extraction API built with **Node.js and Express**.

The API accepts a LinkedIn profile URL and returns the major information available on the profile as structured JSON, including:

- Basic profile information
- Profile and background images
- About
- Experience
- Experience-associated skills
- Education
- Skills
- Licenses & certifications
- Languages

The implementation communicates directly with LinkedIn's internal HTTP / SDUI / RSC endpoints.

> **No Playwright, Puppeteer, Selenium, Chromium, headless browser, or DOM automation is used at runtime.**

---

## Live API

### Production URL

```text
https://linkedin-profile-api-navy.vercel.app
```

### Profile API

```text
POST https://linkedin-profile-api-navy.vercel.app/api/profile
```

---

# Quick Test

Send a `POST` request to:

```text
https://linkedin-profile-api-navy.vercel.app/api/profile
```

with:

```json
{
  "profileUrl": "https://www.linkedin.com/in/sangamesh-lingshetty-5a6647279"
}
```

---

## cURL

```bash
curl -X POST "https://linkedin-profile-api-navy.vercel.app/api/profile" \
  -H "Content-Type: application/json" \
  -d '{
    "profileUrl": "https://www.linkedin.com/in/sangamesh-lingshetty-5a6647279"
  }'
```

### Windows PowerShell

```powershell
curl.exe -X POST "https://linkedin-profile-api-navy.vercel.app/api/profile" `
  -H "Content-Type: application/json" `
  -d "{\"profileUrl\":\"https://www.linkedin.com/in/sangamesh-lingshetty-5a6647279/\"}"
```

---

# Postman

Create a new request in Postman.

### Method

```text
POST
```

### URL

```text
https://linkedin-profile-api-navy.vercel.app/api/profile
```

### Header

```text
Content-Type: application/json
```

### Body

Select:

```text
Body → raw → JSON
```

and use:

```json
{
  "profileUrl": "https://www.linkedin.com/in/sangamesh-lingshetty-5a6647279/"
}
```

Equivalent request:

```bash
POST 'https://linkedin-profile-api-navy.vercel.app/api/profile'

Content-Type: application/json

{
  "profileUrl": "https://www.linkedin.com/in/sangamesh-lingshetty-5a6647279/"
}
```

---

# Example Response

```json
{
    "profileUrl": "https://www.linkedin.com/in/sangamesh-lingshetty-5a6647279/",
    "vanityName": "sangamesh-lingshetty-5a6647279",
    "profile": {
        "name": "Sangamesh Lingshetty",
        "headline": "Software Engineer | Backend & Full Stack | Node.js, TypeScript, AWS, PostgreSQL, React | 1.5 YOE | Bengaluru / Remote India",
        "location": "Greater Bengaluru Area",
        "pronouns": "He/Him"
    },
    "images": {
        "profile": "https://media.licdn.com/dms/image/v2/D4D03AQEet5qqs5AXEg/profile-displayphoto-crop_800_800/B4DZ6Jr1qmKoAI-/0/1780426434989?e=1789603200&v=beta&t=izOxIpWTS79gpUfvNzGNyN9QBuQnVdyisuosSyupFb4",
        "background": "https://media.licdn.com/dms/image/v2/D4D16AQHoriJ2nhYpCw/profile-displaybackgroundimage-shrink_350_1400/B4DZ9xqOa5KsAU-/0/1784318322816?e=1789603200&v=beta&t=Q0WMzIEjTVM6jTfOrV9oiwWu9kPhz2xKflO9AnggbjU"
    },
    "about": "I’m a Backend / Full Stack Engineer with 1.5 years of experience building scalable APIs, integrations, and SaaS products using Node.js, TypeScript, AWS, PostgreSQL, Redis, MongoDB, and React.\nCurrently, I work at Aquera, My work includes API integrations, data sync flows, error handling, debugging production issues, and building reliable backend workflows.\nOutside work, I build and ship real products end to end:\nDeepLock: Android app + Chrome extension for focus and app blocking\nJob Autofill: Chrome extension that helps users fill job applications faster\nNextOffer: AI job discovery agent that finds fresh backend/full-stack jobs from direct ATS sources\nGetQuest: AI-powered vendor security questionnaire automation platform\nI’m actively looking for Backend Engineer, Full Stack Engineer, Software Engineer, and AI Engineer roles where I can work on APIs, backend systems, SaaS platforms, AI integrations, and scalable product engineering.\nCore stack: Node.js, TypeScript, Express.js, React, Next.js, PostgreSQL, MongoDB, Redis, AWS Lambda, SQS, S3, Docker, REST APIs, GitHub Actions.",
    "experience": [
        {
            "title": "Member Technical Staff -1",
            "company": "Aquera",
            "employmentType": "Full-time",
            "dateRange": "Feb 2025 - Present",
            "duration": "1 yr 7 mos",
            "location": "Bengaluru, Karnataka, India",
            "workMode": "On-site",
            "description": "Backend Engineer - Aquera\nFeb 2025 - Present | Bengaluru, India\nBuilt backend APIs and enterprise integrations using Node.js, REST APIs, AWS, PostgreSQL, and event-driven workflows.\n\nWorked on integrations with Entra ID, Okta, ADP, Workday, Dayforce, ServiceNow, and Active Directory.\n\nDebugged production issues, handled API failures, improved error handling, and supported customer-facing integration flows.\n\nBuilt scalable backend logic for user provisioning, deprovisioning, identity sync, and HRIS workflows.\nSkills: Microservices Architecture • AWS Lambda • Node.js • API Development • DevOps • Team Leadership",
            "skills": [
                "Node.js",
                "Amazon Web Services (AWS)",
                "Express.js",
                "PostgreSQL",
                "JavaScript"
            ]
        }
    ],
    "education": [
        {
            "school": "Dayananda Sagar University",
            "degree": "Bachelor of Engineering - BE",
            "fieldOfStudy": "Computer Science",
            "dateRange": "Nov 2022 – Jun 2025",
            "grade": "Bachelor of Technology - Computer Science & Engineering",
            "activities": [
                "Special Recognition Award (2025)",
                "Hackathon Winner (College-level)",
                "Problem Solving: 100+ LeetCode problems solved"
            ],
            "description": "Relevant Coursework: Data Structures & Algorithms • Database Management Systems • Operating Systems • Computer Networks • Cloud Computing • Software Engineering",
            "schoolLogo": null
        }
    ],
    "skills": [
        {
            "id": "565475854",
            "name": "Generative AI"
        },
        {
            "id": "1760560923",
            "name": "Node.js"
        },
        {
            "id": "4",
            "name": "Amazon Web Services (AWS)"
        },
        {
            "id": "2079023045",
            "name": "Continuous Integration and Continuous Delivery (CI/CD)"
        },
        {
            "id": "2078881723",
            "name": "Systems Design"
        },
        {
            "id": "2078901449",
            "name": "Microservices Architecture"
        },
        {
            "id": "1760560925",
            "name": "MongoDB"
        },
        {
            "id": "6",
            "name": "PostgreSQL"
        },
        {
            "id": "134661385",
            "name": "Software Development"
        },
        {
            "id": "1760560922",
            "name": "Full-Stack Development"
        },
        {
            "id": "1760560931",
            "name": "Back-End Web Development"
        },
        {
            "id": "1600533160",
            "name": "JavaScript"
        },
        {
            "id": "5",
            "name": "Express.js"
        },
        {
            "id": "1760560935",
            "name": "Machine Learning"
        },
        {
            "id": "1760560916",
            "name": "Firebase"
        },
        {
            "id": "1760560932",
            "name": "GitHub"
        },
        {
            "id": "1760560928",
            "name": "Computer Science Education"
        },
        {
            "id": "188918615",
            "name": "Debugging"
        },
        {
            "id": "2",
            "name": "HTML5"
        },
        {
            "id": "3",
            "name": "Css3"
        },
        {
            "id": "1760560927",
            "name": "Tailwind CSS"
        },
        {
            "id": "665970567",
            "name": "Responsive Web Design"
        },
        {
            "id": "188870939",
            "name": "React.js"
        },
        {
            "id": "24629764",
            "name": "Document Object Model (DOM)"
        },
        {
            "id": "705474631",
            "name": "Redux.js"
        },
        {
            "id": "1760560926",
            "name": "Next.js"
        },
        {
            "id": "2006604222",
            "name": "Java"
        },
        {
            "id": "1",
            "name": "C (Programming Language)"
        },
        {
            "id": "1796014201",
            "name": "Web Development"
        },
        {
            "id": "1760560917",
            "name": "Role-Based Access Control (RBAC)"
        },
        {
            "id": "665986986",
            "name": "Teamwork"
        },
        {
            "id": "665958567",
            "name": "Communication"
        },
        {
            "id": "207824643",
            "name": "Problem Solving"
        },
        {
            "id": "1255318316",
            "name": "Skill Development"
        }
    ],
    "certifications": [
        {
            "id": null,
            "name": "Special Appreciation",
            "issuingOrganization": "Aquera",
            "issueDate": "Sep 2025",
            "expirationDate": null,
            "credentialId": null,
            "credentialUrl": null,
            "issuerLogo": "https://media.licdn.com/dms/image/v2/D560BAQGTBr55hlk8hA/company-logo_400_400/B56ZUg0IL8GoAY-/0/1740012291416/aquera_logo?e=1789603200&v=beta&t=6C9uMatWUDeBuSLI0YYL5c93sns0SPqYGz2kDnW6tvI",
            "media": [
                {
                    "name": "20251012_103828.jpg",
                    "url": "https://media.licdn.com/dms/image/v2/D562DAQHc6o8hxZL_zA/profile-treasury-image-shrink_8192_8192/B56ZnW0f80JkAg-/0/1760245713072?e=1788674400&v=beta&t=LwQmKLyDAa9HoeHLKtrZq6GrV458QpZb9JiD7gOhSyY"
                }
            ]
        }
    ],
    "languages": [
        {
            "name": "English",
            "proficiency": "Professional working proficiency"
        }
    ],
    "meta": {
        "source": "linkedin",
        "partial": false,
        "warnings": []
    }
}
```

Optional values are returned as `null` or empty arrays when LinkedIn does not expose reliable information for that field.

The API prefers returning `null` instead of returning incorrectly associated or malformed data.

---

# Architecture

```text
                        Client
                          |
                          |
                    POST /api/profile
                          |
                          v
                   Express API
                          |
                          v
                Validate LinkedIn URL
                          |
                          v
                 Extract vanityName
                          |
                          v
              Authenticated HTTP Client
                          |
                          v
          LinkedIn Internal SDUI / RSC APIs
                          |
          +---------------+---------------+
          |               |               |
          v               v               v
       Profile        Experience       Education
       / About           Skills          Skills
                                          |
                         +----------------+
                         |
                         v
                  Certifications
                  Languages
                         |
                         v
                  Structural Parsers
                         |
                         v
                   Normalize Data
                         |
                         v
                  Structured JSON
```

The public API exposes a single clean endpoint while multiple LinkedIn requests may be executed internally to retrieve different profile sections.

---

# Project Structure

```text
src/
├── server.js
│   Express application, API routes and section-level error handling
│
├── linkedin-client.js
│   Authenticated LinkedIn HTTP request wrapper
│
├── linkedin-url.js
│   LinkedIn profile URL validation and vanity-name extraction
│
├── basic-profile.js
│   Basic profile information and profile image extraction
│
├── about.js
│   About section extraction
│
├── experience.js
│   Experience extraction and experience-associated skills
│
├── education.js
│   Education extraction and pagination
│
├── skills.js
│   Skills extraction and pagination
│
├── certifications.js
│   Licenses and certifications extraction
│
├── languages.js
│   Languages extraction
│
└── rsc-parser.js
    Shared structural SDUI / RSC parsing utilities

tests/
├── fixtures/
└── *.test.js
```

---

# Reverse-Engineering Approach

LinkedIn's current profile pages do not expose all profile information through a simple public REST API.

I approached the problem by manually studying the network traffic generated while navigating LinkedIn profile pages.

Browser developer tools were used **only during the research phase** to understand the request contracts.

The production application does not depend on a browser.

The final runtime architecture reproduces those requests directly from the Node.js backend using HTTP requests.

```text
LinkedIn UI
    |
    v
Inspect network traffic manually
    |
    v
Identify internal profile requests
    |
    v
Understand request payloads
    |
    v
Reproduce requests with Node.js
    |
    v
Parse LinkedIn SDUI / RSC responses
    |
    v
Normalize into clean JSON
```

---

# No Browser Automation

This project intentionally does not use:

```text
Playwright
Puppeteer
Selenium
Chromium
Chrome automation
DOM scraping
```

The production flow is:

```text
Node.js
   |
   v
Native HTTP / fetch
   |
   v
LinkedIn internal endpoints
   |
   v
SDUI / RSC responses
   |
   v
Parser
   |
   v
JSON API
```

This was an important design requirement of the assignment.

---

# Profile URL Processing

The API accepts a LinkedIn profile URL such as:

```text
https://www.linkedin.com/in/example-user/
```

The vanity name is extracted dynamically:

```text
example-user
```

The vanity name is then used when making LinkedIn requests.

No profile names, company names, school names, IDs, dates, skills, or profile-specific values are hardcoded.

---

# Basic Profile

Basic profile information is retrieved from the authenticated LinkedIn profile page:

```text
GET https://www.linkedin.com/in/{vanityName}/
```

The parser extracts fields such as:

```text
name
headline
location
pronouns
profile image
background image
```

Image URLs are validated before they are returned.

If LinkedIn exposes an incomplete or malformed media URL, the API returns:

```json
{
  "profile": null
}
```

instead of exposing an invalid URL.

---

# About

LinkedIn loads the About section through its server-driven UI system.

The implementation reproduces the relevant internal component request under:

```text
/flagship-web/rsc-action/actions/component
```

The About component is identified structurally from LinkedIn's returned SDUI / RSC response.

---

# Experience

Experience is retrieved from LinkedIn's internal profile details route:

```text
POST /flagship-web/in/{vanityName}/details/experience/
```

The parser extracts:

```text
title
company
employmentType
dateRange
duration
location
workMode
description
skills
```

Example:

```json
{
  "title": "Software Engineer",
  "company": "Appinventiv",
  "employmentType": "Full-time",
  "dateRange": "Sep 2022 - Present",
  "duration": "4 yrs",
  "location": "Noida, Uttar Pradesh, India",
  "workMode": null,
  "description": null,
  "skills": [
    "NoSQL",
    "Database Design",
    "Angular",
    "Databases",
    "Node.js",
    "REST APIs"
  ]
}
```

---

# Grouped Experience

LinkedIn may group several positions under the same company.

For example:

```text
Company
 |
 +-- Software Engineer
 |
 +-- Software Trainee
```

The parser handles grouped positions and applies company-level information to child roles only when structurally appropriate.

Child-specific values such as:

```text
employment type
location
dates
```

override inherited parent information when explicitly available.

---

# Experience-Associated Skills

LinkedIn exposes skills associated with individual positions through another internal navigation request.

The implementation reproduces the relevant skill-association request dynamically for each position.

Example:

```json
{
  "title": "Software Engineer",
  "skills": [
    "Node.js",
    "PostgreSQL",
    "Amazon Web Services (AWS)"
  ]
}
```

Skill extraction is scoped to the relevant skill-association component to prevent unrelated page content from being incorrectly interpreted as a skill.

---

# Education

Education is retrieved through:

```text
POST /flagship-web/in/{vanityName}/details/education/
```

The parser extracts:

```text
school
degree
fieldOfStudy
dateRange
grade
activities
description
schoolLogo
```

Example:

```json
{
  "school": "Example University",
  "degree": "Bachelor of Technology",
  "fieldOfStudy": "Computer Science",
  "dateRange": "2021 – 2025",
  "grade": null,
  "activities": [],
  "description": null,
  "schoolLogo": null
}
```

---

# Education Pagination

Profiles may contain several education records.

The implementation follows LinkedIn's pagination contract until:

```text
no next page exists
an empty page is returned
a page/cursor repeats
the configured safety limit is reached
```

Each pagination response is parsed independently.

---

# Education Metadata Safety

School logos and other optional metadata are only returned when they can be reliably associated with the corresponding education record.

A logo is not copied from a neighboring record.

If ownership is uncertain:

```json
{
  "schoolLogo": null
}
```

is returned.

Correctness is preferred over completeness.

---

# Skills

Skills are retrieved from:

```text
POST /flagship-web/in/{vanityName}/details/skills/
```

The endpoint may return multiple pages.

The implementation supports LinkedIn pagination and combines results after each page has been parsed independently.

Example:

```json
{
  "id": "1305218168",
  "name": "Node.js"
}
```

One important reverse-engineering detail is that LinkedIn's React Server Component references are response-local.

A reference from one response cannot safely be resolved using data from another response.

Each response is therefore resolved independently before results are merged.

---

# Certifications

Licenses and certifications are retrieved from:

```text
POST /flagship-web/in/{vanityName}/details/certifications/
```

Returned fields include:

```text
id
name
issuingOrganization
issueDate
expirationDate
credentialId
credentialUrl
issuerLogo
media
```

Example:

```json
{
  "id": null,
  "name": "Example Certification",
  "issuingOrganization": "Example Organization",
  "issueDate": "Jan 2026",
  "expirationDate": null,
  "credentialId": null,
  "credentialUrl": null,
  "issuerLogo": null,
  "media": []
}
```

The parser supports certification layouts where LinkedIn does not expose an explicit certification ID.

Malformed internal serialization fragments are rejected instead of being exposed through the API.

---

# Languages

Languages are retrieved through:

```text
POST /flagship-web/in/{vanityName}/details/languages/
```

Example with proficiency:

```json
{
  "name": "English",
  "proficiency": "Professional working proficiency"
}
```

Example without proficiency:

```json
{
  "name": "French",
  "proficiency": null
}
```

---

# Why the Responses Are Parsed as Text

Several LinkedIn internal endpoints return serialized React Server Components / SDUI payloads instead of normal REST JSON.

The responses are therefore intentionally handled as text.

The project does not attempt to implement the complete React Server Components protocol.

Instead, it extracts the stable structural signals needed for the profile sections supported by this challenge.

This keeps the implementation focused while still supporting different real-world LinkedIn profile layouts.

---

# Section-Level Error Isolation

Profile sections are fetched independently.

A failure in one optional section does not necessarily make the entire profile request fail.

Example:

```text
Profile          SUCCESS
About            SUCCESS
Experience       SUCCESS
Education        SUCCESS
Skills           SUCCESS
Certifications   FAILED
Languages        SUCCESS
```

The API can still return all successfully extracted information.

Metadata can indicate that the response was partial:

```json
{
  "meta": {
    "source": "linkedin",
    "partial": true,
    "warnings": [
      "Certifications could not be extracted"
    ]
  }
}
```

---

# Supported Error Codes

The API uses structured errors for common failures.

```text
INVALID_LINKEDIN_URL
LINKEDIN_AUTH_FAILED
LINKEDIN_FORBIDDEN
LINKEDIN_RATE_LIMITED
LINKEDIN_REQUEST_FAILED
PROFILE_NOT_FOUND
LINKEDIN_SESSION_EXPIRED
EXTRACTION_FAILED
TIMEOUT
```

Example:

```json
{
  "error": {
    "code": "INVALID_LINKEDIN_URL",
    "message": "A valid LinkedIn profile URL is required."
  }
}
```

---

# Local Development

## Requirements

- Node.js
- npm
- An authenticated LinkedIn session belonging to an account you control

---

## Clone

```bash
git clone https://github.com/sangamesh-Lingshetty/linkedin-profile-api.git
cd linkedin-profile-api
```

---

## Install Dependencies

```bash
npm install
```

---

## Environment Variables

Create:

```text
.env
```

or copy the example:

```bash
cp .env.example .env
```

Configure:

```env
LINKEDIN_COOKIE=
LINKEDIN_CSRF_TOKEN=
PORT=3000
```

`LINKEDIN_COOKIE` and `LINKEDIN_CSRF_TOKEN` must correspond to the same authenticated LinkedIn session.

Never commit actual authentication credentials.

---

## Start Locally

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

---

# Test Locally

```bash
curl -X POST "http://localhost:3000/api/profile" \
  -H "Content-Type: application/json" \
  -d '{
    "profileUrl": "https://www.linkedin.com/in/example/"
  }'
```

---

# Automated Tests

Run:

```bash
npm test
```

The current implementation contains **80 automated tests** covering parser behavior and regression cases discovered while testing different LinkedIn profile structures.

Test coverage includes:

- LinkedIn URL validation
- Vanity-name extraction
- Basic profile parsing
- Profile-image validation
- Invalid media URL rejection
- About parsing
- Standalone Experience
- Grouped Experience
- Employment type extraction
- Experience location handling
- Child-role location handling
- Experience descriptions
- Description boundary protection
- Experience-associated skills
- Skill contamination prevention
- Education parsing
- Education pagination
- Education entity boundaries
- School-logo ownership
- Invalid education metadata filtering
- Top-level Skills
- Skills pagination
- Response-local RSC references
- Valid one-character skills such as `R`
- Certification parsing
- Certifications without explicit IDs
- Certification pagination
- Invalid serialization fragments
- Languages
- Section-level error isolation

Real LinkedIn profiles with different layouts were used during development to identify edge cases.

No profile-specific values are hardcoded into the extraction logic.

---

# Deployment

The API is deployed publicly on **Vercel**.

```text
https://linkedin-profile-api-navy.vercel.app
```

Profile endpoint:

```text
https://linkedin-profile-api-navy.vercel.app/api/profile
```

Required production environment variables:

```text
LINKEDIN_COOKIE
LINKEDIN_CSRF_TOKEN
```

They are configured using Vercel environment variables and are not stored in the repository.

The Express application is exported so Vercel can execute it as a serverless function.

---

# Production Test

```bash
curl -X POST "https://linkedin-profile-api-navy.vercel.app/api/profile" \
  -H "Content-Type: application/json" \
  -d '{
    "profileUrl": "https://www.linkedin.com/in/sangamesh-lingshetty-5a6647279/"
  }'
```

---

# Security

Real LinkedIn authentication credentials are never committed to the repository.

Secrets are loaded through environment variables.

The repository should never contain real values for:

```text
li_at
JSESSIONID
Cookie headers
CSRF tokens
Authorization headers
```

Test fixtures use sanitized data.

---

# Rate Limits and Account Safety

LinkedIn's internal APIs are private, undocumented and protected by anti-abuse systems.

This application does not attempt to bypass:

```text
CAPTCHA
checkpoints
account restrictions
rate limits
access controls
authentication challenges
```

If LinkedIn rejects or rate-limits a request, the application fails safely instead of performing aggressive retries.

High-volume profile extraction may result in LinkedIn temporarily restricting the authenticated account.

This project is therefore intended as an engineering demonstration for the hiring challenge rather than as a high-volume LinkedIn scraping service.

---

# Key Engineering Decisions

## 1. Direct HTTP Instead of Browser Automation

The objective of the challenge was to reverse engineer LinkedIn's internal APIs.

The production architecture therefore uses:

```text
Node.js
Express
native fetch
LinkedIn HTTP endpoints
```

rather than automating a browser.

---

## 2. Dynamic Extraction

No profile-specific values are hardcoded.

The same extraction flow is used for every profile:

```text
LinkedIn URL
      |
      v
vanityName
      |
      v
internal requests
      |
      v
structural parser
      |
      v
normalized JSON
```

---

## 3. Correctness Over Completeness

If information cannot be reliably associated with an entity, the API prefers:

```json
null
```

instead of returning incorrect information.

For example:

```text
Incomplete LinkedIn image URL
        |
        v
Reject
        |
        v
profile: null
```

This is preferable to returning a malformed media URL.

---

## 4. Entity-Scoped Parsing

LinkedIn responses may contain several entities inside the same RSC response.

The parser avoids globally assigning nearby values.

Example:

```text
Experience A
├── title
├── company
├── dates
├── location
└── description

Experience B
├── title
├── company
├── dates
├── location
└── description
```

Metadata is associated with its corresponding structural entity whenever possible.

The same principle is used for:

```text
Experience
Education
Certifications
Skills
```

---

## 5. Defensive Parsing

LinkedIn internal payloads may contain:

```text
RSC references
serialization tokens
component metadata
class identifiers
internal navigation state
image candidates
```

These should never appear as user-facing profile values.

The parser therefore performs validation before exposing extracted data.

---

# Development Process

The project was developed incrementally.

```text
1. Studied LinkedIn profile network requests manually

2. Identified the internal server-driven architecture

3. Reproduced authenticated LinkedIn requests with Node.js

4. Built a reusable LinkedIn HTTP client

5. Implemented LinkedIn URL validation

6. Reverse engineered Experience

7. Added grouped Experience support

8. Reverse engineered Experience skill associations

9. Reverse engineered About

10. Reverse engineered Education

11. Implemented Education pagination

12. Reverse engineered Skills

13. Implemented Skills pagination

14. Reverse engineered Certifications

15. Added certification pagination and id-less record support

16. Reverse engineered Languages

17. Added basic profile fields and image extraction

18. Tested multiple real LinkedIn profile structures

19. Added regression fixtures for discovered edge cases

20. Hardened entity boundaries and malformed-data filtering

21. Added section-level failure isolation

22. Expanded automated tests to 80 test cases

23. Deployed the Express API publicly on Vercel

24. Validated the production API using a real LinkedIn profile
```

Manual browser inspection was used only to understand how LinkedIn's internal requests work.

The deployed implementation does not depend on browser automation.

---

# Known Limitations

LinkedIn's internal APIs are undocumented and may change without notice.

Current limitations include:

1. LinkedIn may change internal endpoint contracts at any time.
2. Authentication sessions eventually expire.
3. LinkedIn may apply temporary restrictions or checkpoints.
4. Different profiles may use different SDUI component structures.
5. Optional fields may legitimately return `null`.
6. Some uncommon layouts may expose partial information.
7. Profile images may return `null` if a complete media URL cannot be reliably resolved.
8. School or issuer logos may return `null` when structural ownership is ambiguous.
9. This project does not attempt to bypass LinkedIn anti-abuse systems.
10. Activity/posts, recommendations, Featured content, Services, Projects, publications, honors and similar secondary sections are outside the current scope.

The implementation focuses on extracting the major profile information requested by the challenge.

---

# Tech Stack

```text
Node.js
JavaScript
Express.js
Native Fetch
Vercel
Node Test Runner
```

---

# API Reference

## Extract Profile

### Request

```http
POST /api/profile
Content-Type: application/json
```

### Body

```json
{
  "profileUrl": "https://www.linkedin.com/in/example/"
}
```

### Production

```text
POST https://linkedin-profile-api-navy.vercel.app/api/profile
```

---

# Repository

```text
https://github.com/sangamesh-Lingshetty/linkedin-profile-api
```

---

# Assignment Summary

The goal of this project was to reverse engineer LinkedIn's internal profile APIs and expose the major profile information through a clean hosted API.

The final implementation demonstrates:

- Reverse engineering of undocumented web APIs
- Direct authenticated HTTP communication
- Server-driven UI / RSC response analysis
- Structural data extraction
- Pagination
- Error handling
- Defensive parsing
- Automated regression testing
- Express API design
- Serverless deployment
- Secret management

---

# Disclaimer

This project was created as an engineering hiring challenge to demonstrate reverse engineering, backend API development, structured data extraction, testing and deployment.

LinkedIn is a trademark of LinkedIn Corporation.

This project is not affiliated with, sponsored by, or endorsed by LinkedIn.
