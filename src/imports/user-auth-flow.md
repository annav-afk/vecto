You are building an authentication system for a SaaS web application.

Create a secure user registration and login flow with email and password. The application must store user credentials in a database and allow users to log in later using the same credentials.

Requirements:

1. Registration Screen
Create a registration interface with the following fields:
- Email
- Password
- Confirm Password

Validation rules:
- Email must be in valid email format.
- Password must contain at least 8 characters.
- Confirm password must match password.

When the user submits the form:
- Check if the email already exists in the database.
- If the email already exists, show the message:
  "This email is already registered. Please log in instead."

If the email does not exist:
- Create a new user account.
- Store the email and a securely hashed password in the database.
- Create a user profile record linked to the user ID.

After successful registration:
- Show message "Account created successfully".
- Redirect the user to the login screen.

2. Login Screen
Create a login interface with:
- Email field
- Password field
- Login button
- "Forgot password?" link

When the user logs in:
- Verify that the email exists.
- Verify that the password matches the stored hashed password.

If login is successful:
- Create a user session.
- Redirect the user to the main dashboard.

3. Error Handling

If email does not exist:
Show message:
"Account not found. Please check your email or create a new account."

If password is incorrect:
Show message:
"Incorrect password. Try again or reset your password."

4. Password Reset

If the user clicks "Forgot password":
- Ask for email.
- Send a password reset link to the email.
- Allow the user to create a new password after verification.

5. Security Requirements

- Passwords must never be stored as plain text.
- Passwords must always be hashed before saving.
- The database must only return user-safe data.
- Authentication must create a secure user session.

6. Database Structure

Users table:
- id (uuid)
- email (unique)
- password_hash
- created_at

Profiles table:
- id (linked to user id)
- email
- created_at

7. UX behavior

If a user enters incorrect credentials:
- Keep them on the login screen.
- Show the correct error message.
- Allow retry.

If login is successful:
- Redirect to the main application dashboard.

Build the UI and logic for this authentication flow including validation, error states, and database interaction.