const cache = new Map();

async function getUser(id) {
  if (cache.has(id)) return cache.get(id);
  // Simulated async DB call
  const user = await new Promise((resolve) =>
    setTimeout(() => resolve({ id, name: `User_${id}`, createdAt: Date.now() }), 10)
  );
  cache.set(id, user);
  return user;
}

function clearCache() {
  cache.clear();
}

function paginate(items, page, perPage) {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

module.exports = { getUser, clearCache, paginate };
