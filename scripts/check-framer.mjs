import { withConnection } from "framer-api";

const projectUrl = process.env.FRAMER_PROJECT_URL;
const apiKey = process.env.FRAMER_API_KEY;
const targetCollectionName = process.env.FRAMER_COLLECTION_NAME ?? "Blog";

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

if (!projectUrl || !apiKey) {
  console.error(
    "FRAMER_PROJECT_URL and FRAMER_API_KEY must be set before running npm run framer:check",
  );
  process.exit(1);
}

await withConnection(
  projectUrl,
  async (framer) => {
    const collections = await framer.getCollections();
    console.log(`Connected to project. Collections found: ${collections.length}`);

    for (const collection of collections) {
      console.log(
        `- ${collection.name} (${collection.id}) [managedBy=${collection.managedBy}]`,
      );
    }

    const blogCollection = collections.find(
      (collection) => normalize(collection.name) === normalize(targetCollectionName),
    );

    if (!blogCollection) {
      console.error(`Collection "${targetCollectionName}" was not found.`);
      process.exit(1);
    }

    const [fields, items] = await Promise.all([
      blogCollection.getFields(),
      blogCollection.getItems(),
    ]);

    console.log("");
    console.log(`Target collection: ${blogCollection.name} (${blogCollection.id})`);
    console.log(`Slug field: ${blogCollection.slugFieldName ?? "n/a"}`);
    console.log(`Fields: ${fields.length}`);
    for (const field of fields) {
      console.log(`  - ${field.name} (${field.id}) [type=${field.type}]`);
    }

    console.log("");
    console.log(`Items fetched: ${items.length}`);
    for (const item of items.slice(0, 5)) {
      console.log(`  - ${item.slug} (${item.id}) draft=${item.draft}`);
    }

    console.log("");
    console.log("Framer connection check passed.");
  },
  apiKey,
);
