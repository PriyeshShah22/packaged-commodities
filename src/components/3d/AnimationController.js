import * as THREE from 'three';

export const ANIMATION_STATES = {
  IDLE: 'IDLE',
  LOOK_AT_PACKAGE: 'LOOK_AT_PACKAGE',
  RAISE_SCANNER: 'RAISE_SCANNER',
  SCAN: 'SCAN',
  RETURN_TO_IDLE: 'RETURN_TO_IDLE',
};

/**
 * InspectorAnimationController
 * 
 * Kinematic skeletal animation state machine for the 3D Human Inspector.
 * Smoothly interpolates joint angles (quaternions & eulers) between states,
 * generates natural breathing cycles, and drives the optical scanning sweep.
 */
export class InspectorAnimationController {
  constructor(bones, packagePosition = new THREE.Vector3(0.5, 0.45, 0.4)) {
    this.bones = bones;
    this.packagePosition = packagePosition;

    this.currentState = ANIMATION_STATES.IDLE;
    this.targetState = ANIMATION_STATES.IDLE;
    
    this.stateTime = 0;
    this.scanProgress = 0; // 0.0 to 1.0
    this.isLaserActive = false;

    this.sequenceRunning = false;
    this.sequenceStage = 0;
    this.sequenceTimer = 0;

    // Callbacks
    this.onStateChange = null;
    this.onScanProgress = null;
    this.onSequenceComplete = null;

    // Resting Default Rotations
    this.poseResting = {
      head: new THREE.Euler(0, 0, 0),
      neck: new THREE.Euler(0, 0, 0),
      chest: new THREE.Euler(0, 0, 0),
      spine: new THREE.Euler(0, 0, 0),
      rightUpperArm: new THREE.Euler(0.08, 0, -0.12),
      rightForeArm: new THREE.Euler(-0.25, 0, 0),
      rightHand: new THREE.Euler(0, 0, 0),
    };

    // Target Joint Rotations Container (dynamically interpolated)
    this.currentJoints = {
      head: this.poseResting.head.clone(),
      neck: this.poseResting.neck.clone(),
      chest: this.poseResting.chest.clone(),
      spine: this.poseResting.spine.clone(),
      rightUpperArm: this.poseResting.rightUpperArm.clone(),
      rightForeArm: this.poseResting.rightForeArm.clone(),
      rightHand: this.poseResting.rightHand.clone(),
    };
  }

  setState(state) {
    this.currentState = state;
    this.stateTime = 0;
    if (this.onStateChange) this.onStateChange(state);
  }

  startSequence() {
    this.sequenceRunning = true;
    this.sequenceStage = 1;
    this.sequenceTimer = 0;
    this.setState(ANIMATION_STATES.LOOK_AT_PACKAGE);
  }

  resetToIdle() {
    this.sequenceRunning = false;
    this.sequenceStage = 0;
    this.sequenceTimer = 0;
    this.scanProgress = 0;
    this.isLaserActive = false;
    this.setState(ANIMATION_STATES.RETURN_TO_IDLE);
  }

  /**
   * update
   * Called every frame inside requestAnimationFrame loop
   */
  update(deltaTime) {
    this.stateTime += deltaTime;

    // 1. Sequence Director
    if (this.sequenceRunning) {
      this.sequenceTimer += deltaTime;

      if (this.sequenceStage === 1 && this.sequenceTimer > 0.5) {
        // Step 1: Look at Package -> Raise Scanner
        this.sequenceStage = 2;
        this.sequenceTimer = 0;
        this.setState(ANIMATION_STATES.RAISE_SCANNER);
      } else if (this.sequenceStage === 2 && this.sequenceTimer > 0.8) {
        // Step 2: Raise Scanner -> Scan
        this.sequenceStage = 3;
        this.sequenceTimer = 0;
        this.setState(ANIMATION_STATES.SCAN);
      } else if (this.sequenceStage === 3 && this.sequenceTimer > 2.0) {
        // Step 3: Scan complete -> Return to Idle
        this.sequenceStage = 4;
        this.sequenceTimer = 0;
        this.setState(ANIMATION_STATES.RETURN_TO_IDLE);
      } else if (this.sequenceStage === 4 && this.sequenceTimer > 0.9) {
        // Step 4: Back to Idle
        this.sequenceRunning = false;
        this.sequenceStage = 0;
        this.sequenceTimer = 0;
        this.setState(ANIMATION_STATES.IDLE);
        if (this.onSequenceComplete) this.onSequenceComplete();
      }
    }

    // 2. State-Specific Targets
    const targetPose = {
      head: this.poseResting.head.clone(),
      neck: this.poseResting.neck.clone(),
      chest: this.poseResting.chest.clone(),
      spine: this.poseResting.spine.clone(),
      rightUpperArm: this.poseResting.rightUpperArm.clone(),
      rightForeArm: this.poseResting.rightForeArm.clone(),
      rightHand: this.poseResting.rightHand.clone(),
    };

    const time = performance.now() * 0.001;
    const breath = Math.sin(time * 2.2) * 0.02;

    switch (this.currentState) {
      case ANIMATION_STATES.IDLE:
        this.isLaserActive = false;
        // Subtle natural breathing
        targetPose.chest.x = breath;
        targetPose.chest.y = Math.sin(time * 0.8) * 0.015;
        targetPose.head.x = breath * 0.5;
        targetPose.rightUpperArm.x = 0.08 + breath * 0.3;
        break;

      case ANIMATION_STATES.LOOK_AT_PACKAGE:
        this.isLaserActive = false;
        // Turn head & chest towards the package on the stage (right & slightly down)
        targetPose.head.y = 0.35; // Yaw towards package
        targetPose.head.x = 0.18; // Pitch down towards table
        targetPose.neck.y = 0.15;
        targetPose.chest.y = 0.12;
        break;

      case ANIMATION_STATES.RAISE_SCANNER:
        this.isLaserActive = false;
        // Looking at package
        targetPose.head.y = 0.38;
        targetPose.head.x = 0.2;
        targetPose.chest.y = 0.15;
        // Raise right arm pointing scanner forward and angled at package
        targetPose.rightUpperArm.x = 0.85;  // Raised forward
        targetPose.rightUpperArm.y = -0.35; // Angled inwards
        targetPose.rightUpperArm.z = -0.15;
        targetPose.rightForeArm.x = -1.15;  // Elbow bent up
        targetPose.rightForeArm.y = 0.25;
        targetPose.rightHand.x = 0.35;     // Aim optical nozzle at top of package
        break;

      case ANIMATION_STATES.SCAN: {
        this.isLaserActive = true;
        // Calculate scanning progress: 0 to 1 over state time (~2.0s)
        const scanDuration = 2.0;
        this.scanProgress = Math.min(this.stateTime / scanDuration, 1.0);
        if (this.onScanProgress) this.onScanProgress(this.scanProgress);

        // Smooth controlled arm sweep down the label
        const sweepAngle = (this.scanProgress - 0.5) * 0.25;

        targetPose.head.y = 0.38 + Math.sin(time * 3) * 0.01;
        targetPose.head.x = 0.22 + (this.scanProgress * 0.08); // Head nods along with scan
        targetPose.chest.y = 0.15;

        targetPose.rightUpperArm.x = 0.82 - (this.scanProgress * 0.18); // Upper arm lowers slightly
        targetPose.rightUpperArm.y = -0.32;
        targetPose.rightUpperArm.z = -0.15;

        targetPose.rightForeArm.x = -1.10 + (this.scanProgress * 0.22); // Forearm rotates down
        targetPose.rightForeArm.y = 0.25;

        targetPose.rightHand.x = 0.32 - (this.scanProgress * 0.28); // Wrist articulates laser line down
        targetPose.rightHand.y = sweepAngle * 0.5;
        break;
      }

      case ANIMATION_STATES.RETURN_TO_IDLE:
        this.isLaserActive = false;
        // Interpolating back to resting pose
        break;
    }

    // 3. Smooth Damped Interpolation (Slerp-like Euler lerp)
    const lerpSpeed = 4.5 * deltaTime;
    const damp = (current, target) => {
      current.x += (target.x - current.x) * Math.min(lerpSpeed, 1.0);
      current.y += (target.y - current.y) * Math.min(lerpSpeed, 1.0);
      current.z += (target.z - current.z) * Math.min(lerpSpeed, 1.0);
    };

    damp(this.currentJoints.head, targetPose.head);
    damp(this.currentJoints.neck, targetPose.neck);
    damp(this.currentJoints.chest, targetPose.chest);
    damp(this.currentJoints.spine, targetPose.spine);
    damp(this.currentJoints.rightUpperArm, targetPose.rightUpperArm);
    damp(this.currentJoints.rightForeArm, targetPose.rightForeArm);
    damp(this.currentJoints.rightHand, targetPose.rightHand);

    // 4. Apply to 3D Bones
    if (this.bones.head) this.bones.head.rotation.copy(this.currentJoints.head);
    if (this.bones.neck) this.bones.neck.rotation.copy(this.currentJoints.neck);
    if (this.bones.chest) this.bones.chest.rotation.copy(this.currentJoints.chest);
    if (this.bones.spine) this.bones.spine.rotation.copy(this.currentJoints.spine);
    if (this.bones.rightUpperArm) this.bones.rightUpperArm.rotation.copy(this.currentJoints.rightUpperArm);
    if (this.bones.rightForeArm) this.bones.rightForeArm.rotation.copy(this.currentJoints.rightForeArm);
    if (this.bones.rightHand) this.bones.rightHand.rotation.copy(this.currentJoints.rightHand);
  }
}
