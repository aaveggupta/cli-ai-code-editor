import chalk from 'chalk';

export class Logger {
  static info(message: string, ...args: any[]) {
    console.log(chalk.blue('[INFO]'), message, ...args);
  }

  static success(message: string, ...args: any[]) {
    console.log(chalk.green('[SUCCESS]'), message, ...args);
  }

  static warning(message: string, ...args: any[]) {
    console.log(chalk.yellow('[WARNING]'), message, ...args);
  }

  static error(message: string, ...args: any[]) {
    console.error(chalk.red('[ERROR]'), message, ...args);
  }

  static step(step: number, total: number, message: string) {
    console.log(chalk.cyan(`[${step}/${total}]`), message);
  }

  static section(title: string) {
    console.log('\n' + chalk.bold.magenta('═'.repeat(50)));
    console.log(chalk.bold.magenta(title));
    console.log(chalk.bold.magenta('═'.repeat(50)) + '\n');
  }
}
