// touch-input.js
var TouchInput = pc.createScript('touchInput');

TouchInput.attributes.add('orbitSensitivity', {
    type: 'number', 
    default: 0.4, 
    title: 'Orbit Sensitivity', 
    description: 'How fast the camera moves around the orbit. Higher is faster'
});

TouchInput.attributes.add('distanceSensitivity', {
    type: 'number', 
    default: 0.2, 
    title: 'Distance Sensitivity', 
    description: 'How fast the camera moves in and out. Higher is faster'
});

// initialize code called once per entity
TouchInput.prototype.initialize = function() {
    this.orbitCamera = this.entity.script.orbitCamera;
    
    // Store the position of the touch so we can calculate the distance moved
    this.lastTouchPoint = new pc.Vec2();
    this.lastPinchMidPoint = new pc.Vec2();
    this.lastPinchDistance = 0;
    
    if (this.orbitCamera && this.app.touch) {
        // Use the same callback for the touchStart, touchEnd and touchCancel events as they 
        // all do the same thing which is to deal the possible multiple touches to the screen
        this.app.touch.on(pc.EVENT_TOUCHSTART, this.onTouchStartEndCancel, this);
        this.app.touch.on(pc.EVENT_TOUCHEND, this.onTouchStartEndCancel, this);
        this.app.touch.on(pc.EVENT_TOUCHCANCEL, this.onTouchStartEndCancel, this);
        
        this.app.touch.on(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
        
        this.on('destroy', function() {
            this.app.touch.off(pc.EVENT_TOUCHSTART, this.onTouchStartEndCancel, this);
            this.app.touch.off(pc.EVENT_TOUCHEND, this.onTouchStartEndCancel, this);
            this.app.touch.off(pc.EVENT_TOUCHCANCEL, this.onTouchStartEndCancel, this);

            this.app.touch.off(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
        });
    }
};


TouchInput.prototype.getPinchDistance = function (pointA, pointB) {
    // Return the distance between the two points
    var dx = pointA.x - pointB.x;
    var dy = pointA.y - pointB.y;    
    
    return Math.sqrt((dx * dx) + (dy * dy));
};


TouchInput.prototype.calcMidPoint = function (pointA, pointB, result) {
    result.set(pointB.x - pointA.x, pointB.y - pointA.y);
    result.scale(0.5);
    result.x += pointA.x;
    result.y += pointA.y;
};


TouchInput.prototype.onTouchStartEndCancel = function(event) {
    // We only care about the first touch for camera rotation. As the user touches the screen, 
    // we stored the current touch position
    var touches = event.touches;
    if (touches.length == 1) {
        this.lastTouchPoint.set(touches[0].x, touches[0].y);
    
    } else if (touches.length == 2) {
        // If there are 2 touches on the screen, then set the pinch distance
        this.lastPinchDistance = this.getPinchDistance(touches[0], touches[1]);
        this.calcMidPoint(touches[0], touches[1], this.lastPinchMidPoint);
    }
};


TouchInput.fromWorldPoint = new pc.Vec3();
TouchInput.toWorldPoint = new pc.Vec3();
TouchInput.worldDiff = new pc.Vec3();


TouchInput.prototype.pan = function(midPoint) {
    var fromWorldPoint = TouchInput.fromWorldPoint;
    var toWorldPoint = TouchInput.toWorldPoint;
    var worldDiff = TouchInput.worldDiff;
    
    // For panning to work at any zoom level, we use screen point to world projection
    // to work out how far we need to pan the pivotEntity in world space 
    var camera = this.entity.camera;
    var distance = this.orbitCamera.distance;
    
    camera.screenToWorld(midPoint.x, midPoint.y, distance, fromWorldPoint);
    camera.screenToWorld(this.lastPinchMidPoint.x, this.lastPinchMidPoint.y, distance, toWorldPoint);
    
    worldDiff.sub2(toWorldPoint, fromWorldPoint);
     
    this.orbitCamera.pivotPoint.add(worldDiff);    
};


TouchInput.pinchMidPoint = new pc.Vec2();

TouchInput.prototype.onTouchMove = function(event) {
    var pinchMidPoint = TouchInput.pinchMidPoint;
    
    // We only care about the first touch for camera rotation. Work out the difference moved since the last event
    // and use that to update the camera target position 
    var touches = event.touches;
    if (touches.length == 1) {
        var touch = touches[0];
        
        this.orbitCamera.pitch -= (touch.y - this.lastTouchPoint.y) * this.orbitSensitivity;
        this.orbitCamera.yaw -= (touch.x - this.lastTouchPoint.x) * this.orbitSensitivity;
        
        this.lastTouchPoint.set(touch.x, touch.y);
    
    } else if (touches.length == 2) {
        // Calculate the difference in pinch distance since the last event
        var currentPinchDistance = this.getPinchDistance(touches[0], touches[1]);
        var diffInPinchDistance = currentPinchDistance - this.lastPinchDistance;
        this.lastPinchDistance = currentPinchDistance;
                
        this.orbitCamera.distance -= (diffInPinchDistance * this.distanceSensitivity * 0.1) * (this.orbitCamera.distance * 0.1);
        
        // Calculate pan difference
        this.calcMidPoint(touches[0], touches[1], pinchMidPoint);
        this.pan(pinchMidPoint);
        this.lastPinchMidPoint.copy(pinchMidPoint);
    }
};


// orbit-camera.js
var OrbitCamera = pc.createScript('orbitCamera');

OrbitCamera.attributes.add('autoRender', {
    type: 'boolean', 
    default: true, 
    title: 'Auto Render', 
    description: 'Disable to only render when camera is moving (saves power when the camera is still)'
});

OrbitCamera.attributes.add('useMultiFrame', {
    type: 'boolean', 
    default: false, 
    title: 'Multi Frame', 
    description: 'Enable to use multiframe super sampling to smooth edges when camera is still'
});

OrbitCamera.attributes.add('distanceMax', {type: 'number', default: 0, title: 'Distance Max', description: 'Setting this at 0 will give an infinite distance limit'});
OrbitCamera.attributes.add('distanceMin', {type: 'number', default: 0, title: 'Distance Min'});
OrbitCamera.attributes.add('pitchAngleMax', {type: 'number', default: 90, title: 'Pitch Angle Max (degrees)'});OrbitCamera.attributes.add('pitchAngleMin', {type: 'number', default: -90, title: 'Pitch Angle Min (degrees)'});


OrbitCamera.attributes.add('inertiaFactor', {
    type: 'number',
    default: 0,
    title: 'Inertia Factor',
    description: 'Higher value means that the camera will continue moving after the user has stopped dragging. 0 is fully responsive.'
});

OrbitCamera.attributes.add('focusEntity', {
    type: 'entity',
    title: 'Focus Entity',
    description: 'Entity for the camera to focus on. If blank, then the camera will use the whole scene'
});

OrbitCamera.attributes.add('frameOnStart', {
    type: 'boolean',
    default: true,
    title: 'Frame on Start',
    description: 'Frames the entity or scene at the start of the application."'
});


// Property to get and set the distance between the pivot point and camera
// Clamped between this.distanceMin and this.distanceMax
Object.defineProperty(OrbitCamera.prototype, "distance", {
    get: function() {
        return this._targetDistance;
    },

    set: function(value) {
        this._targetDistance = this._clampDistance(value);
    }
});


// Property to get and set the pitch of the camera around the pivot point (degrees)
// Clamped between this.pitchAngleMin and this.pitchAngleMax
// When set at 0, the camera angle is flat, looking along the horizon
Object.defineProperty(OrbitCamera.prototype, "pitch", {
    get: function() {
        return this._targetPitch;
    },

    set: function(value) {
        this._targetPitch = this._clampPitchAngle(value);
    }
});


// Property to get and set the yaw of the camera around the pivot point (degrees)
Object.defineProperty(OrbitCamera.prototype, "yaw", {
    get: function() {
        return this._targetYaw;
    },

    set: function(value) {
        this._targetYaw = value;

        // Ensure that the yaw takes the shortest route by making sure that 
        // the difference between the targetYaw and the actual is 180 degrees
        // in either direction
        var diff = this._targetYaw - this._yaw;
        var reminder = diff % 360;
        if (reminder > 180) {
            this._targetYaw = this._yaw - (360 - reminder);
        } else if (reminder < -180) {
            this._targetYaw = this._yaw + (360 + reminder);
        } else {
            this._targetYaw = this._yaw + reminder;
        }
    }
});


// Property to get and set the world position of the pivot point that the camera orbits around
Object.defineProperty(OrbitCamera.prototype, "pivotPoint", {
    get: function() {
        return this._pivotPoint;
    },

    set: function(value) {
        this._pivotPoint.copy(value);
    }
});


// Moves the camera to look at an entity and all its children so they are all in the view
OrbitCamera.prototype.focus = function (focusEntity) {
    // Calculate an bounding box that encompasses all the models to frame in the camera view
    this._buildAabb(focusEntity, 0);

    var halfExtents = this._modelsAabb.halfExtents;

    var distance = Math.max(halfExtents.x, Math.max(halfExtents.y, halfExtents.z));
    distance = (distance / Math.tan(0.5 * this.entity.camera.fov * pc.math.DEG_TO_RAD));
    distance = (distance * 2);

    this.distance = distance;

    this._removeInertia();

    this._pivotPoint.copy(this._modelsAabb.center);
};


OrbitCamera.distanceBetween = new pc.Vec3();

// Set the camera position to a world position and look at a world position
// Useful if you have multiple viewing angles to swap between in a scene
OrbitCamera.prototype.resetAndLookAtPoint = function (resetPoint, lookAtPoint) {
    this.pivotPoint.copy(lookAtPoint);
    this.entity.setPosition(resetPoint);

    this.entity.lookAt(lookAtPoint);

    var distance = OrbitCamera.distanceBetween;
    distance.sub2(lookAtPoint, resetPoint);
    this.distance = distance.length();

    this.pivotPoint.copy(lookAtPoint);

    var cameraQuat = this.entity.getRotation();
    this.yaw = this._calcYaw(cameraQuat);
    this.pitch = this._calcPitch(cameraQuat, this.yaw);

    this._removeInertia();
    this._updatePosition();

    if (!this.autoRender) {
        this.app.renderNextFrame = true;
    }
};


// Set camera position to a world position and look at an entity in the scene
// Useful if you have multiple models to swap between in a scene
OrbitCamera.prototype.resetAndLookAtEntity = function (resetPoint, entity) {
    this._buildAabb(entity, 0);
    this.resetAndLookAtPoint(resetPoint, this._modelsAabb.center);
};


// Set the camera at a specific, yaw, pitch and distance without inertia (instant cut)
OrbitCamera.prototype.reset = function (yaw, pitch, distance) {
    this.pitch = pitch;
    this.yaw = yaw;
    this.distance = distance;

    this._removeInertia();

    if (!this.autoRender) {
        this.app.renderNextFrame = true;
    }
};

/////////////////////////////////////////////////////////////////////////////////////////////
// Private methods

OrbitCamera.prototype.initialize = function () {
    this._checkAspectRatio();

    // Find all the models in the scene that are under the focused entity
    this._modelsAabb = new pc.BoundingBox();
    this._buildAabb(this.focusEntity || this.app.root, 0);

    this.entity.lookAt(this._modelsAabb.center);

    this._pivotPoint = new pc.Vec3();
    this._pivotPoint.copy(this._modelsAabb.center);
    this._lastFramePivotPoint = this._pivotPoint.clone();

    // Calculate the camera euler angle rotation around x and y axes
    // This allows us to place the camera at a particular rotation to begin with in the scene
    var cameraQuat = this.entity.getRotation();

    // Preset the camera
    this._yaw = this._calcYaw(cameraQuat);
    this._pitch = this._clampPitchAngle(this._calcPitch(cameraQuat, this._yaw));
    this.entity.setLocalEulerAngles(this._pitch, this._yaw, 0);

    this._distance = 0;

    this._targetYaw = this._yaw;
    this._targetPitch = this._pitch;

    // If we have ticked focus on start, then attempt to position the camera where it frames
    // the focused entity and move the pivot point to entity's position otherwise, set the distance
    // to be between the camera position in the scene and the pivot point
    if (this.frameOnStart) {
        this.focus(this.focusEntity || this.app.root);
    } else {
        var distanceBetween = new pc.Vec3();
        distanceBetween.sub2(this.entity.getPosition(), this._pivotPoint);
        this._distance = this._clampDistance(distanceBetween.length());
    }

    this._targetDistance = this._distance;

    this._autoRenderDefault = this.app.autoRender;
    this._firstFrame = true;

    // Do not enable autoRender if it's already off as it's controlled elsewhere
    if (this.app.autoRender) {
        this.app.autoRender = this.autoRender;
    }

    if (!this.autoRender) {
        this.app.renderNextFrame = true;
    }

    this._multiframeBusy = false;

    if (this.useMultiFrame) {
        this._multiframe = new Multiframe(this.app.graphicsDevice, this.entity.camera, 5);
    }

    this.on('attr:autoRender', function (value, prev) {
        this.app.autoRender = value;
        if (!this.autoRender) {
            this.app.renderNextFrame = true;
        }
    }, this);

    // Reapply the clamps if they are changed in the editor
    this.on('attr:distanceMin', function (value, prev) {
        this._targetDistance = this._clampDistance(this._distance);
    }, this);

    this.on('attr:distanceMax', function (value, prev) {
        this._targetDistance = this._clampDistance(this._distance);
    }, this);

    this.on('attr:pitchAngleMin', function (value, prev) {
        this._targetPitch = this._clampPitchAngle(this._pitch);
    }, this);

    this.on('attr:pitchAngleMax', function (value, prev) {
        this._targetPitch = this._clampPitchAngle(this._pitch);
    }, this);

    // Focus on the entity if we change the focus entity
    this.on('attr:focusEntity', function (value, prev) {
        if (this.frameOnStart) {
            this.focus(value || this.app.root);
        } else {
            this.resetAndLookAtEntity(this.entity.getPosition(), value || this.app.root);
        }
    }, this);

    this.on('attr:frameOnStart', function (value, prev) {
        if (value) {
            this.focus(this.focusEntity || this.app.root);
        }
    }, this);

    var onResizeCanvas = function () {
        if (!this._multiframe) {
            return;
        }

        /** @type {pc.GraphicsDevice} */
        var device = this.app.graphicsDevice;
        var canvasSize = { width: device.canvas.width / device.maxPixelRatio, height: device.height / device.maxPixelRatio };
        
        if (!this.autoRender) {
            this.app.renderNextFrame = true;
        }
        
        this._multiframe.moved();
        
        var createTexture = (width, height, format) => {
            return new pc.Texture(device, {
                width: width,
                height: height,
                format: format,
                mipmaps: false,
                minFilter: pc.FILTER_NEAREST,
                magFilter: pc.FILTER_NEAREST,
                addressU: pc.ADDRESS_CLAMP_TO_EDGE,
                addressV: pc.ADDRESS_CLAMP_TO_EDGE
            });
        };

        // out with the old
        var old = this.entity.camera.renderTarget;
        if (old) {
            old.colorBuffer.destroy();
            old.depthBuffer.destroy();
            old.destroy();
        }

        // in with the new
        var w = canvasSize.width;
        var h = canvasSize.height;
        var colorBuffer = createTexture(w, h, pc.PIXELFORMAT_R8_G8_B8_A8);
        var depthBuffer = createTexture(w, h, pc.PIXELFORMAT_DEPTH);
        var renderTarget = new pc.RenderTarget({
            colorBuffer: colorBuffer,
            depthBuffer: depthBuffer,
            flipY: false,
            samples: device.maxSamples
        });

        this.entity.camera.renderTarget = renderTarget;

        this._checkAspectRatio();
        if (!this.autoRender) {
            this.app.renderNextFrame = true;
        }
    };

    var onPostRender = function () {
        if (this._multiframe) {
            this._multiframeBusy = this._multiframe.update();
        }
    };

    var onFrameEnd = function () {
        if (this._firstFrame) {
            this._firstFrame = false;
            if (!this.autoRender) {
                this.app.renderNextFrame = true;
            }
        }

        if (this._multiframeBusy && !this.autoRender) {
            this.app.renderNextFrame = true;
        }
    };

    this.app.graphicsDevice.on('resizecanvas', onResizeCanvas, this);
    this.app.on('postrender', onPostRender, this);
    this.app.on('frameend', onFrameEnd, this);

    this.on('destroy', function() {
        this.app.graphicsDevice.off('resizecanvas', onResizeCanvas, this);
        this.app.off('postrender', onPostRender, this);
        this.app.off('frameend', onFrameEnd, this);
        this.app.autoRender = this._defaultAutoRender;

        // var renderTarget = this.entity.camera.renderTarget;
        // if (renderTarget) {
        //     this.entity.camera.renderTarget = null;
        //     renderTarget.destroy();
        // }
    }, this);

    onResizeCanvas.call(this);
};


OrbitCamera.prototype.update = function(dt) {
    // Check if we have are still moving for autorender
    var distanceDiff = Math.abs(this._targetDistance - this._distance);
    var yawDiff = Math.abs(this._targetYaw - this._yaw);
    var pitchDiff = Math.abs(this._targetPitch - this._pitch);
    var pivotDiff = this.pivotPoint.distance(this._lastFramePivotPoint);

    var moved = distanceDiff > 0.001 || yawDiff > 0.01 || pitchDiff > 0.01 || pivotDiff > 0.001;
    if (!this.autoRender) {
        this.app.renderNextFrame = moved || this.app.renderNextFrame;
    }
    
    // Add inertia, if any
    var t = this.inertiaFactor === 0 ? 1 : Math.min(dt / this.inertiaFactor, 1);
    this._distance = pc.math.lerp(this._distance, this._targetDistance, t);
    this._yaw = pc.math.lerp(this._yaw, this._targetYaw, t);
    this._pitch = pc.math.lerp(this._pitch, this._targetPitch, t);
    this._lastFramePivotPoint.copy(this.pivotPoint);

    this._updatePosition();

    if (moved && this._multiframe) {
        this._multiframe.moved();
    }
};


OrbitCamera.prototype._updatePosition = function () {
    // Work out the camera position based on the pivot point, pitch, yaw and distance
    this.entity.setLocalPosition(0,0,0);
    this.entity.setLocalEulerAngles(this._pitch, this._yaw, 0);

    var position = this.entity.getPosition();
    position.copy(this.entity.forward);
    position.scale(-this._distance);
    position.add(this.pivotPoint);
    this.entity.setPosition(position);
};


OrbitCamera.prototype._removeInertia = function () {
    this._yaw = this._targetYaw;
    this._pitch = this._targetPitch;
    this._distance = this._targetDistance;
};


OrbitCamera.prototype._checkAspectRatio = function () {
    var height = this.app.graphicsDevice.height;
    var width = this.app.graphicsDevice.width;

    // Match the axis of FOV to match the aspect ratio of the canvas so
    // the focused entities is always in frame
    this.entity.camera.horizontalFov = height > width;
};


OrbitCamera.prototype._buildAabb = function (entity, modelsAdded) {
    var i = 0, j = 0, meshInstances;
    
    if (entity instanceof pc.Entity) {
        var allMeshInstances = [];
        var renders = entity.findComponents('render');

        for (i = 0; i < renders.length; ++i) {
            meshInstances = renders[i].meshInstances;
            if (meshInstances) {
                for (j = 0; j < meshInstances.length; j++) {
                    allMeshInstances.push(meshInstances[j]);
                }
            }
        }  

        var models = entity.findComponents('model');
        for (i = 0; i < models.length; ++i) {
            meshInstances = models[i].meshInstances;
            if (meshInstances) {
                for (j = 0; j < meshInstances.length; j++) {
                    allMeshInstances.push(meshInstances[j]);
                }
            }
        }  

        for (i = 0; i < allMeshInstances.length; i++) {
            if (modelsAdded === 0) {
                this._modelsAabb.copy(allMeshInstances[i].aabb);
            } else {
                this._modelsAabb.add(allMeshInstances[i].aabb);
            }

            modelsAdded += 1;
        }
    }

    for (i = 0; i < entity.children.length; ++i) {
        modelsAdded += this._buildAabb(entity.children[i], modelsAdded);
    }

    return modelsAdded;
};


OrbitCamera.prototype._calcYaw = function (quat) {
    var transformedForward = new pc.Vec3();
    quat.transformVector(pc.Vec3.FORWARD, transformedForward);

    return Math.atan2(-transformedForward.x, -transformedForward.z) * pc.math.RAD_TO_DEG;
};


OrbitCamera.prototype._clampDistance = function (distance) {
    if (this.distanceMax > 0) {
        return pc.math.clamp(distance, this.distanceMin, this.distanceMax);
    } else {
        return Math.max(distance, this.distanceMin);
    }
};


OrbitCamera.prototype._clampPitchAngle = function (pitch) {
    // Negative due as the pitch is inversed since the camera is orbiting the entity
    return pc.math.clamp(pitch, -this.pitchAngleMax, -this.pitchAngleMin);
};


OrbitCamera.quatWithoutYaw = new pc.Quat();
OrbitCamera.yawOffset = new pc.Quat();

OrbitCamera.prototype._calcPitch = function(quat, yaw) {
    var quatWithoutYaw = OrbitCamera.quatWithoutYaw;
    var yawOffset = OrbitCamera.yawOffset;

    yawOffset.setFromEulerAngles(0, -yaw, 0);
    quatWithoutYaw.mul2(yawOffset, quat);

    var transformedForward = new pc.Vec3();

    quatWithoutYaw.transformVector(pc.Vec3.FORWARD, transformedForward);

    return Math.atan2(transformedForward.y, -transformedForward.z) * pc.math.RAD_TO_DEG;
};


// mouse-input.js
var MouseInput = pc.createScript('mouseInput');

MouseInput.attributes.add('orbitSensitivity', {
    type: 'number', 
    default: 0.3, 
    title: 'Orbit Sensitivity', 
    description: 'How fast the camera moves around the orbit. Higher is faster'
});

MouseInput.attributes.add('distanceSensitivity', {
    type: 'number', 
    default: 0.15, 
    title: 'Distance Sensitivity', 
    description: 'How fast the camera moves in and out. Higher is faster'
});

// initialize code called once per entity
MouseInput.prototype.initialize = function() {
    this.orbitCamera = this.entity.script.orbitCamera;
        
    if (this.orbitCamera) {
        var self = this;
        
        var onMouseOut = function (e) {
           self.onMouseOut(e);
        };
        
        this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
        this.app.mouse.on(pc.EVENT_MOUSEUP, this.onMouseUp, this);
        this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
        this.app.mouse.on(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);

        // Listen to when the mouse travels out of the window
        window.addEventListener('mouseout', onMouseOut, false);
        
        // Remove the listeners so if this entity is destroyed
        this.on('destroy', function() {
            this.app.mouse.off(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
            this.app.mouse.off(pc.EVENT_MOUSEUP, this.onMouseUp, this);
            this.app.mouse.off(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
            this.app.mouse.off(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);

            window.removeEventListener('mouseout', onMouseOut, false);
        });
    }
    
    // Disabling the context menu stops the browser displaying a menu when
    // you right-click the page
    this.app.mouse.disableContextMenu();
  
    this.lookButtonDown = false;
    this.panButtonDown = false;
    this.lastPoint = new pc.Vec2();
};


MouseInput.fromWorldPoint = new pc.Vec3();
MouseInput.toWorldPoint = new pc.Vec3();
MouseInput.worldDiff = new pc.Vec3();


MouseInput.prototype.pan = function(screenPoint) {
    var fromWorldPoint = MouseInput.fromWorldPoint;
    var toWorldPoint = MouseInput.toWorldPoint;
    var worldDiff = MouseInput.worldDiff;
    
    // For panning to work at any zoom level, we use screen point to world projection
    // to work out how far we need to pan the pivotEntity in world space 
    var camera = this.entity.camera;
    var distance = this.orbitCamera.distance;
    
    camera.screenToWorld(screenPoint.x, screenPoint.y, distance, fromWorldPoint);
    camera.screenToWorld(this.lastPoint.x, this.lastPoint.y, distance, toWorldPoint);

    worldDiff.sub2(toWorldPoint, fromWorldPoint);
       
    this.orbitCamera.pivotPoint.add(worldDiff);    
};


MouseInput.prototype.onMouseDown = function (event) {
    switch (event.button) {
        case pc.MOUSEBUTTON_LEFT: {
            this.lookButtonDown = true;
        } break;
            
        case pc.MOUSEBUTTON_MIDDLE: 
        case pc.MOUSEBUTTON_RIGHT: {
            this.panButtonDown = true;
        } break;
    }
};


MouseInput.prototype.onMouseUp = function (event) {
    switch (event.button) {
        case pc.MOUSEBUTTON_LEFT: {
            this.lookButtonDown = false;
        } break;
            
        case pc.MOUSEBUTTON_MIDDLE: 
        case pc.MOUSEBUTTON_RIGHT: {
            this.panButtonDown = false;            
        } break;
    }
};


MouseInput.prototype.onMouseMove = function (event) {    
    var mouse = pc.app.mouse;
    if (this.lookButtonDown) {
        this.orbitCamera.pitch -= event.dy * this.orbitSensitivity;
        this.orbitCamera.yaw -= event.dx * this.orbitSensitivity;
        
    } else if (this.panButtonDown) {
        this.pan(event);   
    }
    
    this.lastPoint.set(event.x, event.y);
};


MouseInput.prototype.onMouseWheel = function (event) {
    this.orbitCamera.distance -= event.wheel * this.distanceSensitivity * (this.orbitCamera.distance * 0.1);
    event.event.preventDefault();
};


MouseInput.prototype.onMouseOut = function (event) {
    this.lookButtonDown = false;
    this.panButtonDown = false;
};

// keyboard-input.js
var KeyboardInput = pc.createScript('keyboardInput');

// initialize code called once per entity
KeyboardInput.prototype.initialize = function() {
    this.orbitCamera = this.entity.script.orbitCamera;
};


KeyboardInput.prototype.postInitialize = function() {
    if (this.orbitCamera) {
        this.startDistance = this.orbitCamera.distance;
        this.startYaw = this.orbitCamera.yaw;
        this.startPitch = this.orbitCamera.pitch;
        this.startPivotPosition = this.orbitCamera.pivotPoint.clone();
    }
};

// update code called every frame
KeyboardInput.prototype.update = function(dt) {
    if (this.orbitCamera) {
        if (this.app.keyboard.wasPressed(pc.KEY_SPACE)) {
            this.orbitCamera.reset(this.startYaw, this.startPitch, this.startDistance);
            this.orbitCamera.pivotPoint = this.startPivotPosition;
        }
    }
};


// multiframe.js
(function () {
    var gamma = 2.2;
    var vshader = "\nattribute vec2 vertex_position;\nvarying vec2 texcoord;\nvoid main(void) {\n    gl_Position = vec4(vertex_position, 0.5, 1.0);\n    texcoord = vertex_position.xy * 0.5 + 0.5;\n}\n";
    var fshader = "\nvarying vec2 texcoord;\nuniform sampler2D multiframeTex;\nuniform float power;\nvoid main(void) {\n    vec4 t = texture2D(multiframeTex, texcoord);\n    gl_FragColor = pow(t, vec4(power));\n}\n";
    var vertexShaderHeader = function (device) {
        // @ts-ignore
        return device.webgl2 ? "#version 300 es\n\n".concat(pc.shaderChunks.gles3VS, "\n") : '';
    };
    var fragmentShaderHeader = function (device) {
        // @ts-ignore
        return (device.webgl2 ? "#version 300 es\n\n".concat(pc.shaderChunks.gles3PS, "\n") : '') +
            "precision ".concat(device.precision, " float;\n\n");
    };
    var supportsFloat16 = function (device) {
        return device.extTextureHalfFloat && device.textureHalfFloatRenderable;
    };
    var supportsFloat32 = function (device) {
        return device.extTextureFloat && device.textureFloatRenderable;
    };
    // lighting source should be stored HDR
    var choosePixelFormat = function (device) {
        return supportsFloat16(device) ? pc.PIXELFORMAT_RGBA16F :
            supportsFloat32(device) ? pc.PIXELFORMAT_RGBA32F :
                pc.PIXELFORMAT_RGBA8;
    };
    // calculate 1d gauss
    var gauss = function (x, sigma) {
        return (1.0 / (Math.sqrt(2.0 * Math.PI) * sigma)) * Math.exp(-(x * x) / (2.0 * sigma * sigma));
    };
    var accumBlend = new pc.BlendState(true, pc.BLENDEQUATION_ADD, pc.BLENDMODE_CONSTANT, pc.BLENDMODE_ONE_MINUS_CONSTANT);
    var noBlend = new pc.BlendState(false);
    // generate multiframe, supersampled AA
    var Multiframe = /** @class */ (function () {
        function Multiframe(device, camera, numSamples) {
            var _this = this;
            this.shader = null;
            this.multiframeTexUniform = null;
            this.powerUniform = null;
            this.textureBiasUniform = null;
            this.accumTexture = null;
            this.accumRenderTarget = null;
            this.sampleId = 0;
            this.samples = [];
            this.enabled = true;
            this.totalWeight = 0;
            this.device = device;
            this.camera = camera;
            this.textureBias = -Math.log2(numSamples);
            this.samples = this.generateSamples(numSamples, false, 2, 0);
            // just before rendering the scene we apply a subpixel jitter
            // to the camera's projection matrix.
            this.camera.onPreRender = function () {
                var camera = _this.camera.camera;
                var pmat = camera.projectionMatrix;
                if (_this.enabled && _this.accumTexture) {
                    var sample = _this.samples[_this.sampleId];
                    pmat.data[8] = sample.x / _this.accumTexture.width;
                    pmat.data[9] = sample.y / _this.accumTexture.height;
                    _this.textureBiasUniform.setValue(_this.sampleId === 0 ? 0.0 : _this.textureBias);
                }
                else {
                    pmat.data[8] = 0;
                    pmat.data[9] = 0;
                    _this.textureBiasUniform.setValue(0.0);
                }
                // look away
                camera._viewProjMatDirty = true;
            };
            this.shader = new pc.Shader(device, {
                attributes: {
                    vertex_position: pc.SEMANTIC_POSITION
                },
                vshader: vertexShaderHeader(device) + vshader,
                fshader: fragmentShaderHeader(device) + fshader
            });
            this.pixelFormat = choosePixelFormat(device);
            this.multiframeTexUniform = device.scope.resolve('multiframeTex');
            this.powerUniform = device.scope.resolve('power');
            this.textureBiasUniform = device.scope.resolve('textureBias');
            var handler = function () {
                _this.destroy();
            };
            device.once('destroy', handler);
            device.on('devicelost', handler);
        }
        // configure sampling
        // numSamples: square root of number of samples: 5 === 25 total samples
        // jitter: enable sample jittering
        // size: size of the filter, in pixels
        // sigma: guassian sigma filter value or 0 to use box filtering instead
        Multiframe.prototype.setSamples = function (numSamples, jitter, size, sigma) {
            if (jitter === void 0) { jitter = false; }
            if (size === void 0) { size = 1; }
            if (sigma === void 0) { sigma = 0; }
            this.textureBias = -Math.log2(numSamples);
            this.samples = this.generateSamples(numSamples, jitter, size, sigma);
            this.sampleId = 0;
        };
        Multiframe.prototype.generateSamples = function (numSamples, jitter, size, sigma) {
            if (jitter === void 0) { jitter = false; }
            if (size === void 0) { size = 1; }
            if (sigma === void 0) { sigma = 0; }
            var samples = [];
            var kernelSize = Math.ceil(3 * sigma) + 1;
            var halfSize = size * 0.5;
            var sx, sy, weight;
            // generate jittered grid samples (poisson would be better)
            for (var x = 0; x < numSamples; ++x) {
                for (var y = 0; y < numSamples; ++y) {
                    // generate sx, sy in range -1..1
                    if (jitter) {
                        sx = (x + Math.random()) / numSamples * 2.0 - 1.0;
                        sy = (y + Math.random()) / numSamples * 2.0 - 1.0;
                    }
                    else {
                        sx = x / (numSamples - 1) * 2.0 - 1.0;
                        sy = y / (numSamples - 1) * 2.0 - 1.0;
                    }
                    // calculate sample weight
                    weight = (sigma <= 0.0) ? 1.0 : gauss(sx * kernelSize, sigma) * gauss(sy * kernelSize, sigma);
                    samples.push(new pc.Vec3(sx * halfSize, sy * halfSize, weight));
                }
            }
            // normalize weights
            var totalWeight = 0;
            samples.forEach(function (v) {
                totalWeight += v.z;
            });
            samples.forEach(function (v) {
                v.z /= totalWeight;
            });
            // closest sample first
            samples.sort(function (a, b) {
                var aL = a.length();
                var bL = b.length();
                return aL < bL ? -1 : (bL < aL ? 1 : 0);
            });
            return samples;
        };
        Multiframe.prototype.destroy = function () {
            if (this.accumRenderTarget) {
                this.accumRenderTarget.destroy();
                this.accumRenderTarget = null;
            }
            if (this.accumTexture) {
                this.accumTexture.destroy();
                this.accumTexture = null;
            }
        };
        Multiframe.prototype.create = function () {
            var source = this.camera.renderTarget.colorBuffer;
            this.accumTexture = new pc.Texture(this.device, {
                width: source.width,
                height: source.height,
                format: this.pixelFormat,
                mipmaps: false,
                minFilter: pc.FILTER_NEAREST,
                magFilter: pc.FILTER_NEAREST
            });
            this.accumRenderTarget = new pc.RenderTarget({
                colorBuffer: this.accumTexture,
                depth: false
            });
        };
        // flag the camera as moved
        Multiframe.prototype.moved = function () {
            this.sampleId = 0;
            this.totalWeight = 0;
        };
        // update the multiframe accumulation buffer.
        // blend the camera's render target colour buffer with the multiframe accumulation buffer.
        // writes results to the backbuffer.
        Multiframe.prototype.update = function () {
            var device = this.device;
            var sampleCnt = this.samples.length;
            var sourceTex = this.camera.renderTarget.colorBuffer;
            // store device blend state
            device.setBlendState(noBlend);
            // in disabled state we resolve directly from source to backbuffer
            if (!this.enabled) {
                this.multiframeTexUniform.setValue(sourceTex);
                this.powerUniform.setValue(1.0);
                (0, pc.drawQuadWithShader)(device, null, this.shader);
                this.activateBackbuffer();
                return false;
            }
            if (this.accumTexture && (this.accumTexture.width !== sourceTex.width ||
                this.accumTexture.height !== sourceTex.height)) {
                this.destroy();
            }
            if (!this.accumTexture) {
                this.create();
            }
            if (this.sampleId < sampleCnt) {
                var sampleWeight = this.samples[this.sampleId].z;
                var blend = sampleWeight / (this.totalWeight + sampleWeight);
                device.setBlendState(accumBlend);
                device.setBlendColor(blend, blend, blend, blend);
                this.multiframeTexUniform.setValue(sourceTex);
                this.powerUniform.setValue(gamma);
                (0, pc.drawQuadWithShader)(device, this.accumRenderTarget, this.shader, null, null);
                this.totalWeight += sampleWeight;
                device.setBlendState(noBlend);
            }
            if (this.sampleId === 0) {
                // first frame - copy the camera render target directly to the back buffer
                this.multiframeTexUniform.setValue(sourceTex);
                this.powerUniform.setValue(1.0);
            }
            else {
                this.multiframeTexUniform.setValue(this.accumTexture);
                this.powerUniform.setValue(1.0 / gamma);
            }
            (0, pc.drawQuadWithShader)(device, null, this.shader);
            if (this.sampleId < sampleCnt) {
                this.sampleId++;
            }
            this.activateBackbuffer();
            return this.sampleId < sampleCnt;
        };
        // activate the backbuffer for upcoming rendering
        Multiframe.prototype.activateBackbuffer = function () {
            var device = this.device;
            device.setRenderTarget(null);
            device.updateBegin();
            device.setViewport(0, 0, device.width, device.height);
            device.setScissor(0, 0, device.width, device.height);
        };
        Multiframe.prototype.copy = function (target) {
            var device = this.device;
            this.multiframeTexUniform.setValue(this.accumTexture);
            this.powerUniform.setValue(1.0 / gamma);
            (0, pc.drawQuadWithShader)(device, target, this.shader);
        };
        return Multiframe;
    }());

    window.Multiframe = Multiframe;
})();

// load-glb.js
var LoadGlb = pc.createScript('loadGlb');
LoadGlb.attributes.add('url', { type: 'string' });

// initialize code called once per entity
LoadGlb.prototype.initialize = function() {
    var self = this;
    utils.loadGlbContainerFromUrl(this.url, null, 'glb-asset', function (err, asset) {
        var renderRootEntity = asset.resource.instantiateRenderEntity();
        self.entity.addChild(renderRootEntity);
        self.app.renderNextFrame = true;
    });
};

// swap method called for script hot-reloading
// inherit your script state here
// LoadGlb.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// http://developer.playcanvas.com/en/user-manual/scripting/

// glb-utils.js
(function(){
    var utils = {};
    var app = pc.Application.getApplication();

    /**
     * @name utils#loadGlbContainerFromAsset
     * @function
     * @description Load a GLB container from a binary asset that is a GLB. If the asset is not loaded yet, it will load the asset.
     * @param {pc.Asset} glbBinAsset The binary asset that is the GLB.
     * @param {Object} options Optional. Extra options to do extra processing on the GLB.
     * @param {String} assetName. Name of the asset.
     * @param {Function} callback The callback function for loading the asset. Signature is `function(string:error, asset:containerAsset)`.
     * If `error` is null, then the load is successful.
     * @returns {pc.Asset} The asset that is created for the container resource.
     */
    utils.loadGlbContainerFromAsset = function (glbBinAsset, options, assetName, callback) {
        var onAssetReady = function (asset) {
            var blob = new Blob([asset.resource]);
            var data = URL.createObjectURL(blob);
            return this.loadGlbContainerFromUrl(data, options, assetName, function (error, asset) {
                callback(error, asset);
                URL.revokeObjectURL(data);
            });
        }.bind(this);

        glbBinAsset.ready(onAssetReady);
        app.assets.load(glbBinAsset);
    };

    /**
     * @name utils#loadGlbContainerFromUrl
     * @function
     * @description Load a GLB container from a URL that returns a `model/gltf-binary` as a GLB.
     * @param {String} url The URL for the GLB
     * @param {Object} options Optional. Extra options to do extra processing on the GLB.
     * @param {String} assetName. Name of the asset.
     * @param {Function} callback The callback function for loading the asset. Signature is `function(string:error, asset:containerAsset)`.
     * If `error` is null, then the load is successful.
     * @returns {pc.Asset} The asset that is created for the container resource.
     */
    utils.loadGlbContainerFromUrl = function (url, options, assetName, callback) {
        var filename = assetName + '.glb';
        var file = {
            url: url,
            filename: filename
        };

        var asset = new pc.Asset(filename, 'container', file, null, options);
        asset.once('load', function (containerAsset) {
            if (callback) {
                // As we play animations by name, if we have only one animation, keep it the same name as
                // the original container otherwise, postfix it with a number
                var animations = containerAsset.resource.animations;
                if (animations.length == 1) {
                    animations[0].name = assetName;
                } else if (animations.length > 1) {
                    for (var i = 0; i < animations.length; ++i) {
                        animations[i].name = assetName + ' ' + i.toString();
                    }
                }

                callback(null, containerAsset);
            }
        });

        app.assets.add(asset);
        app.assets.load(asset);

        return asset;
    };

    window.utils = utils;
})();

