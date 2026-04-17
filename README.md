# HQ - Modern E-Commerce Platform

A premium, full-featured e-commerce solution built with Vanilla JavaScript (Frontend) and Node.js/Express (Backend).

## Features

- **Multi-Role System**:
  - **Customer**: Browse products, cart management, checkout, order history.
  - **Shop Owner**: Manage products, view orders, dashboard statistics.
  - **Admin**: System-wide oversight, user management, shop approval.
- **Modern UI/UX**:
  - Responsive design using `TailwindCSS` with custom premium aesthetics.
  - Interactive elements with micro-animations.
  - Dark/Light mode optimized colors.
- **Backend**:
  - RESTful API with Express.js.
  - SQLite database (Zero-config, portable).
  - JWT Authentication.
  - Role-based Access Control (RBAC).

## Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/your-username/mariq-ecommerce.git
    cd mariq-ecommerce
    ```

2.  **Install Dependencies**
    - **Backend**:
      ```bash
      cd backend
      npm install
      ```
    - **Frontend**: (Optional, serves static files via backend or Live Server)
      ```bash
      npm install
      ```

3.  **Setup Database**
    Initialize the SQLite database and seed sample data:

    ```bash
    cd backend
    npm run init-db
    npm run seed
    ```

4.  **Start the Server**
    ```bash
    # From backend directory
    npm start
    ```
    Server runs at `http://localhost:5000`.

## Project Structure

- `/pages`: HTML Frontend pages.
- `/css`, `/js`: Styles and Client-side logic.
- `/backend`: Node.js API server.
  - `/routes`: API endpoints.
  - `/controllers`: Logic handlers.
  - `/database`: SQLite database file.

## Test Accounts (Seed Data)

- **Admin**: `admin@ecommerce.com` / `123456`
- **Shop**: `techstore@shop.com` / `123456`
- **Customer**: `customer1@email.com` / `123456`

## License

MIT
