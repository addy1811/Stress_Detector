import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const DATASETS = [
  { label: 'Hold Duration', color: '#4fc3f7', idx: 0, yAxisID: 'y'  },
  { label: 'Latency',       color: '#81c784', idx: 1, yAxisID: 'y'  },
  { label: 'WPM',           color: '#ffb74d', idx: 2, yAxisID: 'y2', hidden: true },
  { label: 'Pauses',        color: '#f06292', idx: 3, yAxisID: 'y2' },
  { label: 'CPM',           color: '#ce93d8', idx: 4, yAxisID: 'y2', hidden: true },
];

export default function FeaturePlot({ featureHistory }) {
  if (!featureHistory || featureHistory.length === 0) return null;

  const MAX_POINTS = 120;
  const step    = Math.max(1, Math.floor(featureHistory.length / MAX_POINTS));
  const sampled = featureHistory.filter((_, i) => i % step === 0);

  const data = {
    labels: sampled.map((_, i) => i + 1),
    datasets: DATASETS.map(({ label, color, idx, yAxisID, hidden }) => ({
      label, yAxisID,
      data: sampled.map(f => f[idx]),
      borderColor: color,
      backgroundColor: color + '18',
      fill: false, tension: 0.3,
      pointRadius: 1.5, borderWidth: 1.5,
      hidden: hidden ?? false,
    })),
  };

  const options = {
    responsive: true,
    animation: false,
    plugins: {
      legend: { labels: { color: 'rgba(180,210,240,0.7)', font: { size: 11 }, boxWidth: 20 } },
      title:  { display: false },
    },
    scales: {
      x:  { ticks: { color: 'rgba(150,180,220,0.4)', maxTicksLimit: 10 }, grid: { color: 'rgba(100,150,200,0.1)' } },
      y:  { ticks: { color: 'rgba(150,180,220,0.4)' }, grid: { color: 'rgba(100,150,200,0.1)' },
            title: { display: true, text: 'seconds', color: 'rgba(150,180,220,0.4)', font: { size: 10 } } },
      y2: { position: 'right', ticks: { color: '#f06292' }, grid: { drawOnChartArea: false },
            title: { display: true, text: 'count', color: '#f06292', font: { size: 10 } } },
    },
  };

  return <Line data={data} options={options} />;
}
