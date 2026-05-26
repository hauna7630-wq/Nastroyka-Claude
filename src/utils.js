function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function sum(a, b) {
  return a + b;
}

function fetchWithTimeout(url, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    fetch(url)
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

function sortByField(arr, field) {
  return [...arr].sort((a, b) => (a[field] > b[field] ? 1 : -1));
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

module.exports = { formatDate, sum, fetchWithTimeout, sortByField, debounce };
