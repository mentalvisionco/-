'use client';
import styles from './LeaderboardList.module.css';
import Badge from '@/components/ui/Badge/Badge';

export default function LeaderboardList({ students = [], startRank = 4 }) {
  if (students.length === 0) return null;

  return (
    <div className={styles.list}>
      {students.map((student, idx) => (
        <div key={idx} className={styles.item}>
          <div className={styles.rank}>{startRank + idx}</div>
          <span className={styles.name}>{student.name}</span>
          <Badge variant="accent">{student.points} نقطة</Badge>
        </div>
      ))}
    </div>
  );
}
