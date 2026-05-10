'use client';
import styles from './RatingStars.module.css';
import { IconStar, IconStarFilled } from '@/components/icons';

export default function RatingStars({ value = 0, onChange, size = 22, readonly = false }) {
  return (
    <div className={styles.stars}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          className={`${styles.star} ${star <= value ? styles.filled : ''} ${readonly ? styles.readonly : ''}`}
          onClick={() => !readonly && onChange?.(star)}
          disabled={readonly}
          aria-label={`${star} نجوم`}
        >
          {star <= value
            ? <IconStarFilled size={size} />
            : <IconStar size={size} />
          }
        </button>
      ))}
    </div>
  );
}
