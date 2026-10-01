# Architecture rules

- Create students through the authenticated `createStudent` server function so validation and admin authorization cannot be bypassed.
- Generate new student IDs server-side as unique eight-character codes using only A-D and 0-9, so IDs never expose cohort initials.