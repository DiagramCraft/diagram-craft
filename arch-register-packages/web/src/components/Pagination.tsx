import { TbChevronLeft, TbChevronRight } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { FilterDropdown } from './FilterDropdown';
import styles from './Pagination.module.css';

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export const Pagination = ({
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext
}: {
  pageSize: number;
  pageSizeOptions?: number[];
  onPageSizeChange: (size: number) => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) => (
  <div className={styles.pagination}>
    <FilterDropdown
      label="Page Size"
      variant="secondary"
      value={String(pageSize)}
      onChange={value => onPageSizeChange(Number(value))}
      options={pageSizeOptions.map(size => ({ value: String(size), label: String(size) }))}
    />
    <div className={styles.pageNav}>
      <Button
        size="sm"
        variant="secondary"
        icon={<TbChevronLeft size={12} />}
        disabled={!canGoPrev}
        onClick={onPrev}
      >
        Prev
      </Button>
      <Button
        size="sm"
        variant="secondary"
        icon={<TbChevronRight size={12} />}
        disabled={!canGoNext}
        onClick={onNext}
      >
        Next
      </Button>
    </div>
  </div>
);
