# reso_li

A professional, minimalist interactive polling application for educators and their students.

## Features

- **Poll Creation**: Create polls with unique access codes and passwords
- **Rich Text Questions**: Support for bold, italic, underline, colors, and monospace formatting
- **Single & Multiple Choice**: Configure questions for single or multiple selections
- **Live Results**: Real-time vote counting with animated bar charts via SignalR
- **Dark/Light Theme**: Automatic theme detection with manual toggle
- **Accessible Design**: Uses Atkinson Hyperlegible font for improved readability
- **Timing Control**: Set availability windows for polls
- **Admin Panel**: Manage public polls and view all polls overview

## Tech Stack

- **Backend**: ASP.NET Core 8
- **Real-time**: SignalR
- **Database**: SQLite with Entity Framework Core
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Font**: Atkinson Hyperlegible

## Getting Started

### Prerequisites

- .NET 8 SDK
- Visual Studio 2022 (or VS Code with C# extension)

### Running Locally

1. Open `reso_li.sln` in Visual Studio
2. Press F5 to run, or use the terminal:

```bash
cd src/ResoLi.Web
dotnet run
```

3. Open https://localhost:5001 in your browser

### URLs

| URL | Purpose |
|-----|---------|
| `/` | Home - public poll or access code entry |
| `/for?poll=<code>` | Direct poll access |
| `/ask` | Create a new poll |
| `/manage?poll=<code>` | Asker dashboard (requires poll password) |
| `/public` | Admin panel (requires weekday password) |

## Usage

### Creating a Poll (Asker)

1. Go to `/ask`
2. Enter an access code (e.g., "myworkshop")
3. Set a management password
4. Optionally set availability times
5. Click "Create poll"
6. Add questions with options
7. Share the poll URL with respondents

### Managing a Poll (Asker)

1. Go to `/manage?poll=<code>`
2. Enter your poll password
3. Activate questions to start live polling
4. View real-time results
5. Navigate between questions with "Next question"
6. Reset vote counts as needed

### Responding to a Poll

1. Go to `/` or `/for?poll=<code>`
2. Enter access code if prompted
3. Select your answer(s)
4. Click "Submit"
5. View live results

### Admin Panel

1. Go to `/public`
2. Enter today's weekday as password (e.g., "monday")
3. Set which poll should be the public poll
4. Upload images to public poll questions
5. View overview of all polls

## Project Structure

```
reso_li/
├── reso_li.sln
├── src/
│   └── ResoLi.Web/
│       ├── Controllers/     # API endpoints
│       ├── Hubs/           # SignalR hub
│       ├── Models/         # Data models
│       ├── Data/           # EF Core context
│       ├── Services/       # Business logic
│       └── wwwroot/        # Static frontend files
└── README.md
```

## API Endpoints

### Polls
- `POST /api/polls` - Create poll
- `GET /api/polls/{code}` - Get poll
- `POST /api/polls/{code}/auth` - Authenticate
- `POST /api/polls/{code}/questions` - Add question

### Questions
- `POST /api/questions/{id}/activate` - Activate question
- `POST /api/questions/{id}/vote` - Submit vote
- `POST /api/questions/{id}/reset` - Reset votes

### Admin
- `POST /api/admin/auth` - Admin login
- `GET /api/admin/polls` - List all polls
- `POST /api/admin/public` - Set public poll

## License

MIT
