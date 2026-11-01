import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ExampleRunner } from "../components/ExampleRunner";
import { RichText } from "../components/RichText";
import { SigmaLine } from "../components/SigmaLine";
import { contentFor, type Lesson as LessonContent, type MissionContent } from "../content/lessons";
import { missionById, systemCode } from "../content/missions";
import { DrillCard } from "../drills/DrillCard";
import { applyAndRestore, markLessonDone } from "../save/progress";
import { useSave } from "../save/SaveProvider";

type ViewProps = { missionId: number; lessonNumber: number; lesson: LessonContent; content: MissionContent };

function LessonView({ missionId, lessonNumber, lesson, content }: ViewProps) {
  const { save, update } = useSave();
  const navigate = useNavigate();
  const wasDone = save.missions[String(missionId)]?.lessonsDone.includes(lesson.id) ?? false;
  const [completed, setCompleted] = useState<ReadonlySet<string>>(new Set());
  const sequence = [lesson.predict, ...lesson.drills];
  const lessonIds = content.lessons.map((l) => l.id);

  const firstOpen = sequence.findIndex((d) => !completed.has(d.id));
  const allDone = firstOpen === -1;
  // Drills appear one at a time (reviewing a finished lesson shows them all).
  const visible = wasDone || allDone ? sequence : sequence.slice(0, firstOpen + 1);
  const predictAnswered = wasDone || completed.has(lesson.predict.id);
  const nextLesson = content.lessons[lessonNumber];

  const handleComplete = (drillId: string) => {
    const next = new Set(completed).add(drillId);
    setCompleted(next);
    if (wasDone || !sequence.every((d) => next.has(d.id))) return;
    let restored = false;
    update((s) => {
      const result = applyAndRestore(s, (x) => markLessonDone(x, missionId, lesson.id, new Date()), missionId, lessonIds, new Date());
      restored = result.restored;
      return result.save;
    });
    if (restored) navigate("/map", { state: { justRestored: missionId } });
  };

  return (
    <section aria-labelledby="lesson-title" className="lesson">
      <p className="crumb">
        <Link to={`/mission/${missionId}`}>{systemCode(missionId)} · {missionById(missionId)?.system}</Link> / Lesson {lessonNumber}
      </p>
      <div className="lesson-head">
        <h1 id="lesson-title">{lesson.title}</h1>
        <ol className="dots" aria-label={`${completed.size} of ${sequence.length} done`}>
          {sequence.map((d) => (
            <li key={d.id} className={completed.has(d.id) || wasDone ? "dot done" : "dot"} />
          ))}
        </ol>
      </div>

      <div className="concept panel">
        <RichText text={lesson.concept} />
      </div>

      <h2 className="lesson-sub">Try it</h2>
      <ExampleRunner source={lesson.example.source} stdin={lesson.example.stdin} compileFlags={lesson.example.compileFlags} isRunLocked={!predictAnswered} label={`Example for ${lesson.title}`} />

      <div className="drill-stack">
        {visible.map((drill, i) => (
          <DrillCard key={drill.id} drill={drill} showPredictCode={i !== 0} onComplete={() => handleComplete(drill.id)} />
        ))}
      </div>

      {(allDone || wasDone) && (
        <div className="lesson-done">
          <SigmaLine text={wasDone && !allDone ? "Reviewing is how it sticks. Carry on." : "Lesson complete. That's one more circuit I don't have to hold together myself."} />
          <div className="settings-row">
            {nextLesson ? (
              <Link className="btn btn-primary" to={`/mission/${missionId}/lesson/${lessonNumber + 1}`}>Next: {nextLesson.title} ▸</Link>
            ) : (
              <Link className="btn btn-primary" to={`/mission/${missionId}/checkpoint`}>Checkpoint ▸</Link>
            )}
            <Link className="btn" to={`/mission/${missionId}`}>Mission overview</Link>
          </div>
        </div>
      )}
    </section>
  );
}

/** Missions whose lessons aren't written yet keep a one-button placeholder lesson. */
function PlaceholderLesson({ missionId, lessonNumber }: { missionId: number; lessonNumber: number }) {
  const { update } = useSave();
  const navigate = useNavigate();
  const finish = () => {
    update((s) => markLessonDone(s, missionId, `m${missionId}-l${lessonNumber}`, new Date()));
    navigate(`/mission/${missionId}`);
  };
  return (
    <section aria-labelledby="lesson-title">
      <p className="crumb">
        <Link to={`/mission/${missionId}`}>{systemCode(missionId)} · {missionById(missionId)?.system}</Link> / Lesson {lessonNumber}
      </p>
      <h1 id="lesson-title">Lesson {lessonNumber}</h1>
      <div className="placeholder">This lesson hasn't been written yet.</div>
      <button className="btn btn-primary" onClick={finish}>Finish lesson ▸</button>
    </section>
  );
}

export function Lesson() {
  const { save } = useSave();
  const params = useParams();
  const missionId = Number(params.missionId);
  const lessonNumber = Number(params.lessonNumber);
  const progress = save.missions[String(missionId)];
  const content = contentFor(missionId);

  if (!missionById(missionId) || !progress || progress.status === "locked") return <Navigate to="/" replace />;
  if (!content) return <PlaceholderLesson missionId={missionId} lessonNumber={lessonNumber} />;
  const lesson = content.lessons[lessonNumber - 1];
  if (!lesson) return <Navigate to={`/mission/${missionId}`} replace />;
  return <LessonView key={lesson.id} missionId={missionId} lessonNumber={lessonNumber} lesson={lesson} content={content} />;
}
