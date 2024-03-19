import readline from 'readline';
import process from 'process';
import fs from 'fs';

process.stdin.setEncoding('utf-8');

const reader = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

const updateMetrics = metric => {
  metric.duration = {
    min: Math.min(...metric.values.map(v => v.duration)),
    max: Math.max(...metric.values.map(v => v.duration)),
    avg: metric.values.reduce((acc, v) => acc + v.duration, 0) / metric.values.length
  };
  metric.duration.stddev = Math.sqrt(
    metric.values.reduce((acc, v) => acc + Math.pow(v.duration - metric.duration.avg, 2), 0) /
      metric.values.length
  );
  metric.ops = {
    min: Math.min(...metric.values.map(v => v.ops)),
    max: Math.max(...metric.values.map(v => v.ops)),
    avg: metric.values.reduce((acc, v) => acc + v.ops, 0) / metric.values.length
  };
  metric.ops.stddev = Math.sqrt(
    metric.values.reduce((acc, v) => acc + Math.pow(v.ops - metric.ops.avg, 2), 0) /
      metric.values.length
  );
  metric.perOp = {
    min: Math.min(...metric.values.map(v => v.perOp)),
    max: Math.max(...metric.values.map(v => v.perOp)),
    avg: metric.values.reduce((acc, v) => acc + v.perOp, 0) / metric.values.length
  };
  metric.perOp.stddev = Math.sqrt(
    metric.values.reduce((acc, v) => acc + Math.pow(v.perOp - metric.perOp.avg, 2), 0) /
      metric.values.length
  );
};

const registerMetric = (dest, name, duration, perOp, ops) => {
  dest[name] ??= {
    values: []
  };
  dest[name].values.push({
    duration: Number(duration),
    perOp: Number(perOp),
    ops: Number(ops)
  });
  updateMetrics(dest[name]);
};

const reference = [];
if (process.argv.length > 2) {
  for (const f of process.argv.slice(2)) {
    const d = fs.readFileSync(f, 'utf-8');
    const m = {};
    for (const line of d.split('\n')) {
      const [name, iter, duration, perOp, ops] = line.split(',');
      registerMetric(m, name, duration, perOp, ops);
    }
    reference.push({
      name: f,
      metrics: m
    });
  }
}

const ansiRed = s => `\x1b[31m${s}\x1b[0m`;
const ansiGreen = s => `\x1b[32m${s}\x1b[0m`;

const positiveBetter = a => {
  if (a >= 0) {
    return ansiGreen(`+${a.toFixed(2)}%`);
  } else if (a < 0) {
    return ansiRed(`${a.toFixed(2)}%`);
  }
};

const negativeBetter = a => {
  if (a <= 0) {
    return ansiGreen(`${a.toFixed(2)}%`);
  } else if (a > 0) {
    return ansiRed(`+${a.toFixed(2)}%`);
  }
};

if (reference.length > 0) {
  console.log('\t\t\t\t\tDuration\t\tOps/sec\t\t\tPer op');
  console.log(
    '---------------------------------------------------------------------------------------------------------------'
  );
}

const metrics = {};
reader.on('line', line => {
  const [name, iter, duration, perOp, ops] = line.split(',');
  registerMetric(metrics, name, duration, perOp, ops);

  if (reference.length > 0) {
    for (const r of reference) {
      console.log(`${name}:`);
      const ref = r.metrics[name];
      if (ref) {
        const refDuration = ref.duration.avg;
        const refOps = ref.ops.avg;
        const refPerOp = ref.perOp.avg;
        const durationDiff = (100 * (duration - refDuration)) / refDuration;
        const opsDiff = (100 * (ops - refOps)) / refOps;
        const perOpDiff = (100 * (perOp - refPerOp)) / refPerOp;
        console.log(
          `\t\t${r.name}\t${Number(duration).toFixed(2)}ms (${negativeBetter(
            durationDiff
          )}%)\t${Number(ops).toFixed(2)} (${positiveBetter(opsDiff)}%)\t${Number(perOp).toFixed(
            2
          )}ms/op (${negativeBetter(perOpDiff)}%)`
        );
      }
    }
  }
});

reader.on('close', () => {
  if (reference.length > 0) {
    console.log();
    console.log(
      '---------------------------------------------------------------------------------------------------------------'
    );
    console.log();
    console.log('Summary:');
    console.log();
  }
  for (const key of Object.keys(metrics)) {
    console.log(`${key}:`);

    const durationAvg = metrics[key].duration.avg;
    const durationStddev = metrics[key].duration.stddev;
    console.log(
      `  Time:  \t\t\t${durationAvg.toFixed(2)}ms\t±${durationStddev.toFixed(2)}ms (±${(
        (100 * durationStddev) /
        durationAvg
      ).toFixed(2)}%)`
    );
    for (const ref of reference) {
      const refDuration = ref.metrics[key].duration.avg;
      const refDurationStdDev = ref.metrics[key].duration.stddev;
      const durationDiff = (100 * (durationAvg - refDuration)) / refDuration;
      console.log(
        `\t${ref.name}\t${Number(refDuration).toFixed(2)}ms\t±${refDurationStdDev.toFixed(
          2
        )}ms\t\t(${negativeBetter(durationDiff)}%)`
      );
    }

    const perOpAvg = metrics[key].perOp.avg;
    const perOpStddev = metrics[key].perOp.stddev;
    console.log(`  Per op:\t\t\t${perOpAvg.toFixed(2)}ms/op\t±${perOpStddev.toFixed(2)}ms/op`);
    for (const ref of reference) {
      const refPerOp = ref.metrics[key].perOp.avg;
      const refPerOpStdDev = ref.metrics[key].perOp.stddev;
      const perOpDiff = (100 * (perOpAvg - refPerOp)) / refPerOp;
      console.log(
        `\t${ref.name}\t${Number(refPerOp).toFixed(2)}ms/op\t±${refPerOpStdDev.toFixed(
          2
        )}ms/op\t\t(${negativeBetter(perOpDiff)}%)`
      );
    }

    const opsAvg = metrics[key].ops.avg;
    const opsStddev = metrics[key].ops.stddev;
    console.log(`  Ops/sec:\t\t\t${opsAvg.toFixed(2)}\t±${opsStddev.toFixed(2)}ops`);
    for (const ref of reference) {
      const refOps = ref.metrics[key].ops.avg;
      const refOpsStdDev = ref.metrics[key].ops.stddev;
      const opsDiff = (100 * (opsAvg - refOps)) / refOps;
      console.log(
        `\t${ref.name}\t${Number(refOps).toFixed(2)}\t±${refOpsStdDev.toFixed(
          2
        )}ops\t\t(${positiveBetter(opsDiff)}%)`
      );
    }
  }
});
