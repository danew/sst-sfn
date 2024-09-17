declare global {
  export const $app: Readonly<{
    name: string;
    stage: string;
    removal: "remove" | "retain" | "retain-all";
    providers: any;
  }>
}

export {};