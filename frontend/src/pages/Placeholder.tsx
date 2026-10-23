type Props = { title: string; step?: string; embedded?: boolean }

export default function Placeholder({ title, step, embedded }: Props) {
  return (
    <>
      {!embedded && <h1>{title}</h1>}
      <div className="card empty">{step ? `This screen is built in step ${step}.` : 'Nothing here.'}</div>
    </>
  )
}
