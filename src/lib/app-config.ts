import appConfigJson from "./app-config.json";

type AppConfig = {
  framer: {
    projectId: string;
    collectionName: string;
  };
  notion: {
    dataSourceId: string;
    statusPropertyName: string;
    approvedStatusValue: string;
    slugPropertyName: string;
    framerItemIdPropertyName: string;
    fieldMap: Record<string, string>;
  };
};

export const appConfig: AppConfig = appConfigJson;
