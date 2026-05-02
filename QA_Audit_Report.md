# QA & Security Audit Report - LMS Platform

## 1. Security Testing (Critical Vulnerabilities)

### Issue 1: Privilege Escalation (Authentication Bypass)
**Severity:** Critical
**Location:** `server.js` (Line 105)
**Description:** The registration endpoint allows any user to assign their own role. The backend checks `req.body.role === 'admin'`, meaning a malicious user can register as an admin by simply modifying the API request payload.
**How to reproduce:** 
Send a POST request to `/api/register` with the payload: `{"name":"hacker", "email":"hacker@test.com", "password":"123", "role":"admin"}`.
**Suggested Fix:**
Force the role to be 'student' for all public registrations.
```javascript
// server.js - Line 105
const role = 'student'; // Hardcode the role, remove req.body.role parsing
```

### Issue 2: Stored Cross-Site Scripting (XSS) via Submission URLs
**Severity:** High
**Location:** `server.js` (Line 205) & `client/src/app/admin/page.js` (Line 134)
**Description:** The backend does not validate the format of `fileUrl` submitted by students. A student can submit a malicious payload like `javascript:alert(document.cookie)`. When an admin clicks "عرض الملف المسلم" in the dashboard, the script will execute in the admin's session.
**How to reproduce:**
1. Login as student and submit `javascript:alert('XSS')` in the task URL.
2. Login as admin, go to dashboard, and click the link for that submission.
**Suggested Fix:**
Validate that the URL starts with `http://` or `https://` in the backend.
```javascript
// server.js - Validation section for submissions
if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
  return res.status(400).json({ error: 'يجب أن يكون الرابط صالحاً (يبدأ بـ http أو https)' });
}
```

### Issue 3: Hardcoded JWT Secret Key Fallback
**Severity:** High
**Location:** `server.js` (Line 13)
**Description:** The application falls back to a hardcoded secret key (`'lms_super_secret_key_123'`) if the environment variable is missing. If deployed to production without the env variable, anyone who knows this default string can forge admin JWT tokens.
**How to reproduce:** Decode a student token, change the role to `admin`, re-sign it with `lms_super_secret_key_123`, and use it to access admin endpoints.
**Suggested Fix:**
```javascript
// server.js - Line 13
const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL ERROR: SECRET_KEY is not defined.');
}
```

---

## 2. Performance Review

### Issue 4: Blocking Synchronous Database Disk Writes
**Severity:** Critical
**Location:** `database.js` (Lines 116-126)
**Description:** The application uses `sql.js` (an in-memory SQLite implementation) and writes the *entire database buffer* synchronously to disk (`fs.writeFileSync`) on every single `INSERT`, `UPDATE`, or `DELETE`. This blocks the Node.js event loop, completely halting the server during the write process. As the DB grows, the app will suffer severe performance degradation.
**How to reproduce:** Create a script to send 100 concurrent submission POST requests. The server will freeze and response times will spike massively.
**Suggested Fix:**
Replace `sql.js` with `better-sqlite3` or `sqlite3`, which write directly to the file system natively without blocking the main thread or loading the entire DB into RAM.

### Issue 5: Memory Leak in Rate Limiter
**Severity:** Medium
**Location:** `server.js` (Lines 23-49)
**Description:** The custom rate limiter uses a JS `Map` to store IPs. Old IP records are never deleted, meaning the memory usage will grow indefinitely. Additionally, it lacks proxy trust, meaning if deployed on platforms like Railway, all requests will appear to come from the proxy IP, rate-limiting the entire app.
**How to reproduce:** Send requests from thousands of spoofed IPs or check memory usage over a month.
**Suggested Fix:**
Use the `express-rate-limit` package and configure `app.set('trust proxy', 1);`.

---

## 3. Functional Testing

### Issue 6: Admin Actions are Placeholders
**Severity:** High
**Location:** `client/src/app/admin/page.js` (Lines 204, 220)
**Description:** The "إضافة محاضرة" (Add Lecture) and "تعديل" (Edit) buttons in the admin panel do not function. They simply trigger an `alert()` or do nothing. Admins cannot manage content.
**How to reproduce:** Login as Admin > Go to Lectures > Click Add or Edit.
**Suggested Fix:** Implement functional forms/modals to interact with POST/PUT `/api/lectures` endpoints (which also need to be created in the backend).

### Issue 7: Rating UI is Not Functional
**Severity:** Low
**Location:** `client/src/app/student/page.js` (Line 256)
**Description:** The 5-star rating UI for lectures is purely visual. Clicking the stars does not record a rating in the database.
**How to reproduce:** Login as student > Open a lecture > Try clicking the stars.
**Suggested Fix:** Add an API endpoint `POST /api/lectures/:id/rate`, capture the click event on the stars, and save the rating in a new `ratings` table.

---

## 4. UI/UX Testing & Code Review

### Issue 8: Inaccessible Toggle Links
**Severity:** Low
**Location:** `client/src/app/page.js` (Lines 110, 163)
**Description:** The login/register toggle uses `<a href="#" onClick={...}>`. This is bad for accessibility (screen readers) and UX.
**Suggested Fix:** Change the `<a>` tag to a `<button className="link-button">` to ensure semantic correctness.

### Issue 9: Static Video Placeholder
**Severity:** Medium
**Location:** `client/src/app/student/page.js` (Line 231)
**Description:** The lecture view shows a static placeholder span ("منطقة عرض الفيديو") instead of an actual video player, rendering the core learning feature useless.
**Suggested Fix:**
Replace the placeholder with an iframe or video tag.
```jsx
<video src={`/videos/${activeLecture.videoUrl}`} controls style={{ width: '100%', height: '100%' }} />
```

### Issue 10: Weak Password Policy
**Severity:** Low
**Location:** `server.js` (Line 115)
**Description:** The backend allows passwords of exactly 3 characters.
**Suggested Fix:** Enforce a minimum length of 8 characters and add regex for strength validation.
