import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import AuthSettings from "./AuthSettings";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "ezlocalization.localizeFile",
    async () => {
      AuthSettings.init(context);
      const settings = AuthSettings.instance;

      const inputLanguage = await vscode.window.showInputBox({
        prompt: "Enter the source language name (e.g., en)",
        placeHolder: "en",
      });

      if (!inputLanguage) {
        vscode.window.showErrorMessage("Source language name is required.");
        return;
      }

      const sourceFilePath = vscode.window.activeTextEditor?.document.fileName;
      if (!sourceFilePath || !sourceFilePath.endsWith(".json")) {
        vscode.window.showErrorMessage("Open a .json file to localize.");
        return;
      }

      try {
        const sourceFileContent = fs.readFileSync(sourceFilePath, "utf8");
        const sourceData = JSON.parse(sourceFileContent);

        const targetLanguage = await vscode.window.showInputBox({
          prompt: "Enter the target language name (e.g., fr)",
          placeHolder: "fr",
        });

        if (!targetLanguage) {
          vscode.window.showErrorMessage("Target language name is required.");
          return;
        }

        let geminiApiKey = await settings.getAuthData();

        if (!geminiApiKey) {
          const apiKey = await vscode.window.showInputBox({
            prompt: "Enter Google Gemini API key",
          });

          if (!apiKey) {
            vscode.window.showErrorMessage("Gemini API key is required.");
            return;
          }

          await settings.storeAuthData(apiKey);

          geminiApiKey = apiKey;
        }

        try {
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Please wait, File creation in progress",
              cancellable: false,
            },
            async (progress) => {
              progress.report({ increment: 0 });

              const genAI = new GoogleGenerativeAI(geminiApiKey);
              const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash-latest",
                generationConfig: { responseMimeType: "application/json" },
              }) as any;

              const prompt = `provide only the JSON string as response after translating ${inputLanguage} language in ${targetLanguage} language. Here's the data: ${JSON.stringify(
                sourceData
              )}`;

              const result = await model.generateContent(prompt);
              const response = await result.response;
              const translatedData = response.text();

              progress.report({ increment: 80 });

              const translatedFileName = `${targetLanguage}.json`;
              const translatedFilePath = path.join(
                path.dirname(sourceFilePath),
                translatedFileName
              );
              fs.writeFileSync(translatedFilePath, translatedData, {
                encoding: "utf-8",
              });

              vscode.window.showInformationMessage(
                `Localization completed. File saved as ${translatedFileName}`
              );

              return translatedFileName;
            }
          );
         
        } catch (err) {
          console.log("errorr", err);
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `Error localizing file: ${err.message}`
        );
      }
    }
  );

  context.subscriptions.push(disposable);
}

export async function deactivate(context: vscode.ExtensionContext) {
  AuthSettings.init(context);
  const settings = AuthSettings.instance;

  await settings.storeAuthData("");
}
