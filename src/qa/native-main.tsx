import { createRoot } from 'react-dom/client';
import { NativeQa } from './NativeQa.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('QA root missing');
createRoot(root).render(<NativeQa />);
