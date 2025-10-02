# Ingestion Engine

Ingestion Engine is a TypeScript-based data ingestion service designed to fetch real-time content from various social media APIs, including Twitter and Telegram. It provides a modular and extensible framework for collecting, processing, and managing social media data streams.

## Features

- **Multi-Platform Support:** Fetch messages and content from Twitter and Telegram APIs.
- **Account Management:** Modular account managers for handling multiple social media accounts.
- **Redis Integration:** Store and manage environment variables and session data in Redis.
- **Encryption Utilities:** Secure sensitive data using built-in encryption utilities.
- **Extensible Architecture:** Easily add support for new platforms or data sources.
- **Demo & Test Scripts:** Includes demo scripts for rotation and API usage.

## Project Structure

```
src/
	fetchTelegramMessages.ts      # Fetch messages from Telegram
	index.ts                     # Main entry point
	telegram.ts                  # Telegram API integration
	twitterApi.ts                # Twitter API integration
	twitterApiFollow.ts          # Twitter follow functionality
	services/
		BaseAccountManager.ts      # Abstract account manager
		telegramAccountManager.ts  # Telegram account manager
		twitterAccountManager.ts   # Twitter account manager
	lib/
		encryption.ts              # Encryption utilities
		utils/
			string.ts                # String utilities
	utils/
		moveEnvToRedis.ts          # Move env variables to Redis
		redisUtils.ts              # Redis helper functions
		showEnvVariables.ts        # Display env variables
	tests/
		rotationDemo.ts            # Demo for account rotation
		telegramRotationDemo.ts    # Telegram rotation demo
		testRotation.ts            # Test for rotation logic
		testTelegramRotation.ts    # Test for Telegram rotation
	types/
		global.d.ts                # Global type definitions
		input.d.ts                 # Input type definitions
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Redis](https://redis.io/) (for session and environment management)

### Installation

1. **Clone the repository:**
	 ```bash
	 git clone https://github.com/Sentiopulse/ingestion-engine.git
	 cd ingestion-engine
	 ```

2. **Install dependencies:**
	 ```bash
	 npm install
	 # or
	 yarn install
	 ```

3. **Configure environment variables:**
	 - Copy your environment variables to Redis using the provided utility:
		 ```bash
		 npm run moveEnvToRedis
		 ```
	 - Or set them manually as needed.

4. **Run the service:**
	 ```bash
	 npm start
	 ```

### Usage

- **Fetch Telegram Messages:**
	```bash
	ts-node src/fetchTelegramMessages.ts
	```
- **Test Twitter Follow:**
	```bash
	ts-node src/testTwitterFollow.ts
	```
- **Run Demos:**
	```bash
	ts-node src/tests/rotationDemo.ts
	ts-node src/tests/telegramRotationDemo.ts
	```

> **Note:** Replace `ts-node` with your preferred TypeScript execution method if needed.

## Contributing

Contributions are welcome! Please open issues or submit pull requests for new features, bug fixes, or improvements.

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a pull request

## License

This project is licensed under GNU AFFERO GENERAL PUBLIC LICENSE, Version 3. See the [LICENSE](LICENSE) file for details.

## Contact

For questions or support, please contact the maintainers or open an issue on GitHub.
