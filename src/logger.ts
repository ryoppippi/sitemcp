import c from "picocolors"

type LoggerLevel = "silent" | "warn"

class Logger {
  private level?: LoggerLevel

  setLevel(level: LoggerLevel): void {
    this.level = level
  }

  info(...args: any[]): void {
    if (this.level === "silent") return
    console.info(c.cyan("INFO"), ...args)
  }

  warn(...args: any[]): void {
    if (this.level === "silent") return
    console.warn(c.yellow("WARN"), ...args)
  }
}

export const logger: Logger = new Logger()
