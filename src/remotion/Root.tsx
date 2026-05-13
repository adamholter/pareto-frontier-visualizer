import { Composition } from 'remotion'
import { ParetoVideo } from './ParetoVideo'

export const RemotionRoot = () => {
  return (
    <Composition
      id="ParetoFrontier"
      component={ParetoVideo}
      durationInFrames={720}
      fps={30}
      width={1080}
      height={1350}
    />
  )
}
