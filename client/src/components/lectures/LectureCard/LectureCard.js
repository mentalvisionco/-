'use client';
import styles from './LectureCard.module.css';
import { IconStarFilled } from '@/components/icons';

export default function LectureCard({ lecture, onClick }) {
  return (
    <div className={styles.card} onClick={() => onClick(lecture.id)} role="button" tabIndex={0}>
      <div className={styles.content}>
        <div className={styles.orderBadge}>{lecture.orderNum || '—'}</div>
        <div className={styles.info}>
          <h4 className={styles.title}>{lecture.title}</h4>
          {lecture.description && <p className={styles.desc}>{lecture.description}</p>}
        </div>
      </div>
      <div className={styles.meta}>
        {lecture.avgRating > 0 && (
          <span className={styles.rating}>
            <IconStarFilled size={13} />
            {lecture.avgRating}
          </span>
        )}
        <span className={styles.arrow}>←</span>
      </div>
    </div>
  );
}
