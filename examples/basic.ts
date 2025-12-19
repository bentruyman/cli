import { command, run } from "../src/index";

const greet = command({
  name: "greet",
  description: "A friendly greeting CLI",
  version: "1.0.0",
  args: [
    {
      name: "name",
      description: "Name of the person to greet",
      type: "string",
    },
  ] as const,
  options: {
    shout: {
      type: "boolean",
      short: "s",
      description: "Print the greeting in uppercase",
    },
    times: {
      type: "number",
      short: "n",
      description: "Number of times to repeat the greeting",
    },
    greeting: {
      type: "string",
      short: "g",
      description: "Custom greeting to use instead of 'Hello'",
    },
  },
  handler: ([name], { shout, times, greeting }) => {
    const word = greeting || "Hello";
    let message = `${word}, ${name}!`;

    if (shout) {
      message = message.toUpperCase();
    }

    const count = times || 1;
    for (let i = 0; i < count; i++) {
      console.log(message);
    }
  },
});

run(greet, process.argv.slice(2));
