'use client';
import Modal from '@/components/ui/Modal/Modal';
import RatingStars from '@/components/lectures/RatingStars/RatingStars';
import styles from './RatingsModal.module.css';

export default function RatingsModal({ isOpen, onClose, title, ratings = [] }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`تقييمات: ${title}`} size="md">
      {ratings.length === 0 ? (
        <p className={styles.empty}>لا توجد تقييمات لهذه المحاضرة حتى الآن.</p>
      ) : (
        <div className={styles.list}>
          {ratings.map((r, idx) => (
            <div key={idx} className={styles.item}>
              <div className={styles.header}>
                <strong className={styles.name}>{r.studentName}</strong>
                <RatingStars value={r.rating} readonly size={16} />
              </div>
              {r.comment ? (
                <p className={styles.comment}>&quot;{r.comment}&quot;</p>
              ) : (
                <p className={styles.noComment}>بدون تعليق</p>
              )}
              <small className={styles.date}>
                {r.created_at ? new Date(r.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
              </small>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
