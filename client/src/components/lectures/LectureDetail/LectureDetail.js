'use client';
import styles from './LectureDetail.module.css';
import Button from '@/components/ui/Button/Button';
import Textarea from '@/components/ui/Textarea/Textarea';
import RatingStars from '@/components/lectures/RatingStars/RatingStars';
import Card from '@/components/ui/Card/Card';
import { IconArrowRight, IconExternalLink } from '@/components/icons';

export default function LectureDetail({
  lecture,
  currentRating,
  currentComment,
  onRatingChange,
  onCommentChange,
  onSaveRating,
  onBack,
}) {
  if (!lecture) return null;

  return (
    <div className={styles.wrapper}>
      <Button variant="ghost" size="sm" onClick={onBack} icon={IconArrowRight} iconPosition="start">
        رجوع للمحاضرات
      </Button>

      <Card padding="lg" animate className={styles.mainCard}>
        <h2 className={styles.title}>{lecture.title}</h2>
        {lecture.description && <p className={styles.description}>{lecture.description}</p>}

        {/* Material Link */}
        <div className={styles.materialSection}>
          <div className={styles.materialIcon}>📚</div>
          <div className={styles.materialInfo}>
            <h4>ماتيريال المحاضرة</h4>
            <p>يمكنك الوصول إلى محتوى المحاضرة من خلال الرابط أدناه</p>
          </div>
          <a href={lecture.materialUrl} target="_blank" rel="noopener noreferrer" className={styles.materialLink}>
            <span>عرض الماتيريال</span>
            <IconExternalLink size={14} />
          </a>
        </div>

        {/* Rating Section */}
        <div className={styles.ratingSection}>
          <h4 className={styles.ratingTitle}>قيّم هذه المحاضرة</h4>
          <RatingStars value={currentRating} onChange={onRatingChange} size={28} />
          <Textarea
            placeholder="أضف تعليقاً يصف تجربتك في هذه المحاضرة (اختياري)..."
            value={currentComment}
            onChange={(e) => onCommentChange(e.target.value)}
            rows={3}
          />
          <Button variant="primary" size="md" onClick={onSaveRating} style={{ alignSelf: 'flex-start' }}>
            حفظ التقييم
          </Button>
        </div>
      </Card>
    </div>
  );
}
