'use client';
import styles from './Podium.module.css';

const medals = ['🥇', '🥈', '🥉'];
const variants = ['gold', 'silver', 'bronze'];

export default function Podium({ topThree = [] }) {
  if (topThree.length === 0) return null;

  // Display order: 2nd, 1st, 3rd for visual podium effect
  const displayOrder = [topThree[1], topThree[0], topThree[2]];
  const orderMap = [1, 0, 2]; // maps display index to original rank

  return (
    <div className={styles.grid}>
      {displayOrder.map((student, displayIdx) => {
        const rank = orderMap[displayIdx];
        if (!student) return <div key={displayIdx} className={styles.empty} />;
        return (
          <div key={displayIdx} className={`${styles.card} ${styles[variants[rank]]}`}>
            <span className={styles.medal}>{medals[rank]}</span>
            <div className={styles.name}>{student.name}</div>
            <div className={styles.points}>{student.points} نقطة</div>
          </div>
        );
      })}
    </div>
  );
}
