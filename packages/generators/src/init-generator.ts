import { blue, yellow } from "colorette";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import { CustomGenerator } from "./types";
import { getInstaller, getTemplate } from "./utils/helpers";
import * as Question from "./utils/scaffold-utils";
import handlers from "./handlers";

/**
 *
 * Generator for initializing a webpack config
 *
 * @class 	InitGenerator
 * @extends CustomGenerator
 * @returns {Void} After execution, transforms are triggered
 *
 */
export default class InitGenerator extends CustomGenerator {
  public answers: Record<string, unknown>;
  public configurationPath: string;
  public force: boolean;
  public generationPath: string;
  public packageManager: string;
  public resolvedGenerationPath: string;
  public supportedTemplates: string[];
  public template: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public utils: any;

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
  public constructor(args: any, opts: any) {
    super(args, opts);

    const { options } = opts;

    this.template = options.template;
    this.generationPath = options.generationPath;
    this.resolvedGenerationPath = path.resolve(process.cwd(), this.generationPath);
    this.force = options.force;
    this.dependencies = ["webpack", "webpack-cli"];
    this.supportedTemplates = Object.keys(handlers);
    this.answers = {};
    const { cli } = opts;
    this.utils = cli.utils;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async prompting(): Promise<void | any> {
    if (!existsSync(this.resolvedGenerationPath)) {
      this.utils.logger.log(
        `${blue(
          "ℹ INFO ",
        )} supplied generation path doesn't exist, required folders will be created.`,
      );
      try {
        mkdirSync(this.resolvedGenerationPath, { recursive: true });
      } catch (error) {
        this.utils.logger.error(`Failed to create directory.\n ${error}`);
        process.exit(2);
      }
    }

    this.template = await getTemplate.call(this);

    await handlers[this.template].questions(this, Question);

    // Handle installation of prettier
    try {
      // eslint-disable-next-line node/no-extraneous-require
      require.resolve("prettier");
    } catch (err) {
      const { installPrettier } = await Question.Confirm(
        this,
        "installPrettier",
        "Do you like to install prettier to format generated configuration?",
        true,
        false,
      );

      if (installPrettier) {
        this.dependencies.push("prettier");
      }
    }
  }

  public async installPlugins(): Promise<void> {
    this.packageManager = await getInstaller.call(this);

    const opts: {
      dev?: boolean;
      "save-dev"?: boolean;
    } = this.packageManager === "yarn" ? { dev: true } : { "save-dev": true };

    this.scheduleInstallTask(this.packageManager, this.dependencies, opts, {
      cwd: this.generationPath,
    });
  }

  public writing(): void {
    this.utils.logger.log(`${blue("ℹ INFO ")} Initialising project...`);
    handlers[this.template].generate(this);
  }

  public end(): void {
    // Prettify configuration file if possible
    try {
      // eslint-disable-next-line node/no-extraneous-require, @typescript-eslint/no-var-requires
      const prettier = require("prettier");
      const source = readFileSync(this.configurationPath, {
        encoding: "utf8",
      });
      const formattedSource = prettier.format(source, {
        parser: "babel",
      });
      writeFileSync(this.configurationPath, formattedSource);
    } catch (err) {
      this.utils.logger.log(
        `${yellow(
          `⚠ Generated configuration may not be properly formatted as prettier is not installed.`,
        )}`,
      );
      return;
    }
  }
}
