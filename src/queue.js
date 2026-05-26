class TaskQueue {
  constructor() {
    this.tasks = [];
    this.results = [];
  }

  add(fn) {
    this.tasks.push(fn);
  }

  async run() {
    const promises = this.tasks.map((fn) => fn());
    const results = await Promise.all(promises);
    this.results.push(...results);
    this.tasks = [];
    return results;
  }

  getResults() {
    return this.results;
  }
}

let globalCounter = 0;

function incrementCounter() {
  globalCounter++;
  return globalCounter;
}

function getCounter() {
  return globalCounter;
}

function resetCounter() {
  globalCounter = 0;
}

function randomDelay(min, max) {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.random() * (max - min) + min)
  );
}

async function fetchSequential(ids) {
  const results = [];
  for (const id of ids) {
    await randomDelay(0, 20);
    results.push({ id, value: id * 2 });
  }
  return results;
}

module.exports = { TaskQueue, incrementCounter, getCounter, resetCounter, randomDelay, fetchSequential };
