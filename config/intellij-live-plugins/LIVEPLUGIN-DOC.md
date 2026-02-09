# LivePlugin Documentation

## Overview

LivePlugin is a tool for developing IntelliJ IDE plugins at runtime using Kotlin or Groovy, without requiring IDE restarts. It simplifies the plugin development process, making it accessible for creating project-specific scripts and workflows.

## Key Features

- **Minimal Setup**: No need for a separate project for plugin development.
- **Fast Feedback Loop**: Plugins execute without IDE restarts.
- **Simplified API**: A smaller API surface area for easier IDE extension.

## Getting Started

After installing LivePlugin, a "Plugins" panel appears in any project, listing folders with plugin source code. Example plugins, like "hello-world," are included by default. Plugins are typically defined in `plugin.kts` or `plugin.groovy` files. You can run and modify these plugins directly within the IDE.

## How It Works

1. **Resource Disposal**: Cleans up resources from previous executions.
2. **Compilation**: Compiles source code into `.class` files using a bundled Kotlin compiler.
3. **Execution**: Loads classes into a new classloader and executes them, allowing access to all IDE classes and objects.

## Notifications and Logging

LivePlugin provides functions for displaying notifications and logging messages, essential for debugging since breakpoints are not available. Use `show()` for notifications and `println()` or `Logger` for logging.

## Actions

Actions are stateless functions for user interaction, such as menu items and keymap entries. Use `registerAction()` to define actions, which are executed on the UI thread. Actions can be grouped into action groups for better UI presentation.

## Editor and Document

LivePlugin allows programmatic control of the text editor using `Editor` and `Document` APIs. This includes manipulating text, selections, and caret positions.

## Intentions and Inspections

Intentions and inspections analyze code in the editor, offering transformations or highlighting issues. They work with PSI elements, which represent nodes in an abstract syntax tree.

## IntelliJ APIs Mini Cheat Sheet

LivePlugin wraps some IDE APIs, accessible via the `liveplugin` package. Explore IntelliJ platform source code and SDK documentation for more details on available APIs.

## Final Thoughts

LivePlugin addresses the stereotype of plugin development being difficult by providing a simpler, more accessible approach. It empowers users to extend IDE functionality, potentially leading to a cultural norm of creating tailored plugins for specific projects or libraries.
