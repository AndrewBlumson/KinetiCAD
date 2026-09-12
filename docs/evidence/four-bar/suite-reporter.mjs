export default async function* reporter(source) {
  for await (const event of source) {
    yield JSON.stringify(event, (_key, value) => value instanceof Error
      ? { name: value.name, message: value.message, stack: value.stack, ...value }
      : typeof value === 'bigint' ? String(value) : value) + '\n';
  }
}
