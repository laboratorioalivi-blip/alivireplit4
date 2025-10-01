# Overview

This is a complete dental service order management system with two main parts:

**PART 1 - Client Portal:** Dentists can create detailed work orders with patient information, tooth selection (FDI numbering), and comprehensive configuration for each tooth including materials, colors, and work types. Orders are saved to the database and a PDF is generated with a unique order number.

**PART 2 - Laboratory Admin Panel:** Laboratory technicians access an administrative dashboard to view all incoming orders, filter by status, view complete order details, update order status (pending → in progress → completed), and generate PDFs. The system includes secure authentication and session management.

## Admin Credentials
- **Username:** admin
- **Password:** admin123
- **Access:** /admin/login

## Recent Changes (October 01, 2025)
- **Fresh GitHub Import Setup**: Successfully imported and configured project from GitHub
- **Dependencies Installed**: npm install completed successfully with all required packages (517 packages)
- **Database Setup**: PostgreSQL database verified and migrations applied successfully with drizzle-kit push
- **Admin User**: Default admin user created automatically on server startup (username: admin, password: admin123)
- **Development Workflow**: Configured "Server" workflow to run on port 5000 with npm run dev
- **Deployment**: Autoscale deployment configured with build (npm run build) and run (npm start) commands
- **Vite Configuration**: Already configured with allowedHosts: true and host 0.0.0.0 for Replit proxy support
- **Application Verified**: Both client portal (/) and admin login (/admin/login) tested and working correctly

## Asset References
- **"dente bordo"**: Refers to the logo image `/header-logo.png` (tooth icon used in the header)
- **"dente transparente"**: Refers to the tooth selection icon `/tooth-selection-icon.png` (tooth icon used in the tooth selection card)

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and burgundy color scheme
- **Form Management**: React Hook Form with Zod validation for type-safe form handling
- **State Management**: TanStack React Query for server state and local React state for UI interactions
- **Routing**: Wouter for lightweight client-side routing
- **Data Persistence**: Clean form state on each session start

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Development**: TSX for TypeScript execution with hot reload
- **Build**: ESBuild for production bundling
- **API Design**: RESTful endpoints under `/api` prefix

## Database Design
- **ORM**: Drizzle ORM configured for PostgreSQL with node-postgres driver
- **Schema Management**: Centralized schema definitions in `/shared` directory
- **Validation**: Zod schemas for runtime type checking and API validation
- **Migrations**: Drizzle Kit for database schema migrations

## Data Storage Solutions
- **Primary Database**: PostgreSQL via Replit's internal database (using standard pg driver)
- **Session Storage**: Connect-pg-simple for PostgreSQL-backed sessions
- **File Uploads**: Local filesystem storage in uploads/ directory
- **Client State**: Clean form initialization on each session

## Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL store
- **Security**: Basic request/response logging middleware
- **Error Handling**: Centralized error handling with proper HTTP status codes

## Form Architecture
- **Multi-step Process**: Patient info → tooth selection → individual tooth configuration
- **Dynamic Fields**: Conditional field rendering based on work type selections
- **Form State**: Fresh form state on each application load
- **Validation**: Client-side and server-side validation using shared Zod schemas

## Component Structure
- **Reusable UI**: shadcn/ui component library with custom theming
- **Form Components**: Specialized components for tooth selection and configuration
- **Layout**: Card-based design with clear visual hierarchy
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting
- **Drizzle ORM**: Database toolkit and query builder
- **connect-pg-simple**: PostgreSQL session store

## UI Framework
- **Radix UI**: Headless component primitives for accessibility
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library for consistent iconography
- **shadcn/ui**: Pre-built component library

## Development Tools
- **Vite**: Build tool with React plugin and runtime error overlay
- **TypeScript**: Static type checking
- **ESBuild**: Fast bundler for production builds
- **Replit Integration**: Development environment plugins

## Form and Validation
- **React Hook Form**: Form state management
- **Zod**: Schema validation library
- **TanStack React Query**: Server state management

## Date and Utility Libraries
- **date-fns**: Date manipulation and formatting
- **clsx & class-variance-authority**: Conditional CSS class utilities
- **cmdk**: Command palette component
- **embla-carousel-react**: Carousel component