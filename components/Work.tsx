import Reels from '@/components/Reels';
import EvidenceBoard from '@/components/EvidenceBoard';
import SnapVibe from '@/components/SnapVibe';
import { PROJECTS } from '@/lib/projects';

export default function Work() {
  return (
    <section className="work" id="work">
      <div className="sec-head">
        <span className="rail mono">(WORK)</span>
        <h2 className="sec-title" data-split="chars">
          Projects
        </h2>
        <span className="mono sec-count">{PROJECTS.length} reels</span>
      </div>

      <Reels />

      <EvidenceBoard />

      <SnapVibe />
    </section>
  );
}
