import { Link, Navigate, useParams } from "react-router-dom";
import { SigmaLine } from "../components/SigmaLine";
import { contentFor, warmupPoolBefore } from "../content/lessons";
import { missionById, systemCode } from "../content/missions";
import { problemById } from "../content/problems";
import { CHECKPOINT_PASS, localDateKey, warmupDue } from "../save/progress";
import { useSave } from "../save/SaveProvider";

const BOSS_NUMBERS = [1, 2, 3];
const DIFFICULTY = ["Easy", "Medium", "Hard"];

type StepProps = { num: string; title: string; note: string; done?: boolean; action?: { to: string; label: string; primary?: boolean } };

function Step({ num, title, note, done, action }: StepProps) {
  return (
    <li className={`step ${action ? "" : "step-locked"}`}>
      <span className="step-num">{num}</span>
      <div className="step-body">
        <div className="step-title">{title}</div>
        <div className="step-note">{note}</div>
      </div>
      {done && <span className="step-done">✓ DONE</span>}
      {action ? (
        <Link className={`btn ${action.primary ? "btn-primary" : ""}`} to={action.to}>{action.label}</Link>
      ) : (
        <span className="step-lock">Locked</span>
      )}
    </li>
  );
}

export function Mission() {
  const { save } = useSave();
  const id = Number(useParams().missionId);
  const mission = missionById(id);
  const progress = save.missions[String(id)];

  if (!mission || !progress) return <Navigate to="/" replace />;
  if (progress.status === "locked") return <Navigate to="/map" replace />;

  const content = contentFor(id);
  // Missions with no lessons written yet show one placeholder lesson.
  const lessons = content?.lessons ?? [{ id: `m${id}-l1`, title: "Lesson 1" }];
  const doneCount = lessons.filter((l) => progress.lessonsDone.includes(l.id)).length;
  const allLessonsDone = doneCount === lessons.length;
  const checkpointPassed = progress.checkpointBest >= CHECKPOINT_PASS;
  const bossesOpen = !content || checkpointPassed;
  const firstOpenLesson = lessons.findIndex((l) => !progress.lessonsDone.includes(l.id));

  const hasWarmup = id > 0 && warmupPoolBefore(id).length > 0;
  const warmupToday = hasWarmup && warmupDue(save, id, localDateKey(new Date()));
  const lessonHref = (n: number) =>
    warmupToday ? `/mission/${id}/warmup?next=${encodeURIComponent(`/mission/${id}/lesson/${n}`)}` : `/mission/${id}/lesson/${n}`;

  return (
    <section aria-labelledby="mission-title">
      <p className="crumb">
        <Link to="/map">Station</Link> / {systemCode(id)}
      </p>
      <p className="eyebrow">Mission {id} · {mission.topic}</p>
      <h1 id="mission-title">{mission.system}</h1>
      <SigmaLine text={mission.briefing} />

      <ol className="steps">
        {hasWarmup && (
          <Step
            num="00"
            title="Warm-up"
            note={warmupToday ? "3 quick drills from earlier missions" : "Done for today"}
            done={!warmupToday}
            action={{ to: `/mission/${id}/warmup?next=${encodeURIComponent(`/mission/${id}`)}`, label: warmupToday ? "Warm up" : "Again" }}
          />
        )}
        {lessons.map((lesson, i) => {
          const done = progress.lessonsDone.includes(lesson.id);
          return (
            <Step
              key={lesson.id}
              num={String(i + 1).padStart(2, "0")}
              title={lesson.title}
              note={content ? "Concept, example, predict, drills" : "Not written yet"}
              done={done}
              action={{ to: lessonHref(i + 1), label: done ? "Review" : "Start", primary: i === firstOpenLesson }}
            />
          );
        })}
        {content && (
          <Step
            num="CP"
            title="Checkpoint"
            note={
              allLessonsDone
                ? `5 questions, ${CHECKPOINT_PASS} to pass · best ${progress.checkpointBest}/5`
                : lessons.length === 1
                  ? "Finish the lesson first"
                  : `Finish all ${lessons.length} lessons first`
            }
            done={checkpointPassed}
            action={allLessonsDone ? { to: `/mission/${id}/checkpoint`, label: checkpointPassed ? "Retake" : "Start", primary: !checkpointPassed } : undefined}
          />
        )}
        {BOSS_NUMBERS.map((n) => {
          const problemId = `m${id}-b${n}`;
          const problem = problemById(problemId);
          return (
            <Step
              key={n}
              num={`B${n}`}
              title={problem?.title ?? `Boss ${n}`}
              note={bossesOpen ? `${DIFFICULTY[n - 1]} · judged against test cases` : `Pass the checkpoint to unlock`}
              done={progress.bossesSolved.includes(problemId)}
              action={bossesOpen ? { to: `/mission/${id}/boss/${n}`, label: "Open", primary: checkpointPassed && n === 1 && progress.bossesSolved.length === 0 } : undefined}
            />
          );
        })}
      </ol>
    </section>
  );
}
