# Fake News API

A modern API service for a fake news game. Generating daily real and fake news. Built with Node.js, TypeScript, and powered by AI capabilities.

## 🚀 Features

- **AI-Powered Analysis**: Leverages latest AI models for content creation
- **Type Safety**: Built with TypeScript for robust type checking
- **Modern Architecture**: Clean architecture principles with dependency injection
- **Scalable**: Built on Hono.js for high performance
- **Monitoring**: Integrated with NewRelic for production monitoring

## 📋 Prerequisites

- Node.js 22.x
- npm

## 🛠 Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/jterrazz/fake-news-api.git
   cd fake-news-api
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   touch config/local.yml
   ```

   Then edit file with your configuration.

## 🚀 Usage

### Build

```bash
npm run build
```

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## 🏗 Project Structure

```
config/            # Configuration files
src/
├── application/   # Applications ports and use cases
├── di/            # Dependency injection
├── domain/        # Business logic and interfaces
└── infrastructure/# External service implementations
```

## 📚 Glossary

A concise reference of central concepts used across the Fake News API. This glossary clarifies the language choices so contributors and API consumers share the same mental model. Based on standard journalism terminology, these terms have been refined for precision: "Report" represents a presented or media-sourced account of information pieces; "Angle" reflects neutral journalistic approaches; and "Frame" captures interpretive expressions common in media studies.

### Report

A _Report_ is an abstract, **fact-centric** representation of pieces of information. Reports have no tone or rhetorical flavor—they are the neutral backbone we can link multiple articles to for analysis, emphasizing their reported nature as gathered information.

### Report Angle

An _Angle_ is a **recognized viewpoint** from which the report can be observed. It is still abstract (no concrete text) but acknowledges that observers may emphasize different aspects, such as those held by various parties or stakeholders (e.g., political groups, experts, or affected communities).

Angles do **not** distort information; they merely select what to highlight, drawing from journalism practices where an angle defines the neutral approach without introducing bias.

### Article

An _Article_ is a concrete piece of content (headline + body) published by a source at a certain time. It references one or more Reports and declares which Angle it adopts.

### Article Frame

A _Frame_ is an **expression** of an Angle in a specific Article. Because authors bring biases, a Frame can be _authentic_ (neutral and factual) or _fake_ (distorted or propagandist), often reflecting the viewpoints of different parties involved. Frame therefore carries metadata and an authenticity flag, aligning with media studies where framing indicates how information is structured or emphasized to influence perception.

```
Report         →   Angle (viewpoint)   →   Article Frame (biased or neutral expression)
```

**Why “Angle” vs “Frame”?**

- **Angle** emphasizes _where_ you look from—it is a neutral, journalistic observing position, as defined in standard journalism glossaries.
- **Frame** emphasizes _how_ what you see is structured—potentially shaped by rhetoric, misinformation, or bias, reflecting terms used in media analysis.

Keeping this distinction helps us model real-world media behavior cleanly while giving clients an intuitive API surface, inspired by established schemas in journalism and bias detection.

## 🔧 Configuration

The application uses the `config` package for environment-specific configuration. Configuration files can be found in the `config/` directory.

## 🧪 Testing

This project uses Jest for testing. Tests are organized following the Given/When/Then pattern.

## 👤 Author

**Jean-Baptiste Terrazzoni**

- Email: contact@jterrazz.com
