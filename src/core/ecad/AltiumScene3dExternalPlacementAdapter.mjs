/**
 * Repairs Altium explicit 3D body placements after toolkit scene conversion.
 */
export class AltiumScene3dExternalPlacementAdapter {
    static #EXACT_ANCHOR_TOLERANCE_MIL = 5
    static #NEAR_ANCHOR_TOLERANCE_MIL = 20
    static #FAR_OWNER_DISTANCE_MIL = 100
    static #DEFAULT_BOARD_THICKNESS_MIL = 63
    static #PASSIVE_BODY_PATTERN =
        /\b(cap|capacitor|res|resistor|ind|inductor|ferrite|bead|crystal|xtal|lqw|lqg)\b/i
    static #PIN_ONE_CORNER_PACKAGE_PATTERN =
        /\b(?:qfn|vfqfn|v?qfp|lqfp|tqfp|pqfp|mqfp)\b/i
    static #EDGE_CONNECTOR_TOKENS = new Set([
        'antenna',
        'coax',
        'connector',
        'edge',
        'rf',
        'sma',
        'socket'
    ])
    static #GENERIC_IDENTITY_TOKENS = new Set([
        'body',
        'component',
        'footprint',
        'library',
        'model',
        'package'
    ])

    /**
     * Applies exact-anchor repairs to Altium external 3D placements.
     * @param {object} sceneDescription Built scene description.
     * @param {object} documentModel Source document model.
     * @returns {object}
     */
    static apply(sceneDescription, documentModel) {
        if (
            String(sceneDescription?.sourceFormat || '').toLowerCase() !==
                'altium' ||
            !Array.isArray(sceneDescription?.externalPlacements)
        ) {
            return sceneDescription
        }

        const components = Array.isArray(documentModel?.pcb?.components)
            ? documentModel.pcb.components
            : []
        const pads = Array.isArray(documentModel?.pcb?.pads)
            ? documentModel.pcb.pads
            : []
        const componentBodies = Array.isArray(
            documentModel?.pcb?.componentBodies
        )
            ? documentModel.pcb.componentBodies
            : []
        if (!components.length) {
            return sceneDescription
        }

        const componentByDesignator = new Map(
            components.map((component) => [
                String(component?.designator || ''),
                component
            ])
        )

        return {
            ...sceneDescription,
            externalPlacements: sceneDescription.externalPlacements
                .map((placement) =>
                    AltiumScene3dExternalPlacementAdapter.#repairPlacement(
                        placement,
                        components,
                        componentByDesignator,
                        componentBodies,
                        pads,
                        sceneDescription?.board
                    )
                )
                .filter(Boolean)
        }
    }

    /**
     * Repairs one placement when a weak name match displaced an exact anchor.
     * @param {object} placement External model placement.
     * @param {object[]} components PCB components.
     * @param {Map<string, object>} componentByDesignator Components by designator.
     * @param {object[]} componentBodies Source component body rows.
     * @param {object[]} pads Source PCB pads.
     * @param {object} board Scene board metadata.
     * @returns {object | null}
     */
    static #repairPlacement(
        placement,
        components,
        componentByDesignator,
        componentBodies,
        pads,
        board
    ) {
        if (!placement?.bodyPositionMil || !placement?.positionMil) {
            return placement
        }

        const componentBody =
            AltiumScene3dExternalPlacementAdapter.#resolveComponentBody(
                placement,
                componentBodies
            )
        const currentComponent = componentByDesignator.get(
            String(placement?.designator || '')
        )
        const currentDistance = currentComponent
            ? AltiumScene3dExternalPlacementAdapter.#distanceToBody(
                  placement,
                  currentComponent
              )
            : Number.POSITIVE_INFINITY
        const exactComponent =
            AltiumScene3dExternalPlacementAdapter.#resolveAnchorComponent(
                placement,
                currentComponent,
                components
            )
        const isExactAnchoredOwner =
            (currentComponent &&
                currentDistance <=
                    AltiumScene3dExternalPlacementAdapter
                        .#EXACT_ANCHOR_TOLERANCE_MIL) ||
            (exactComponent &&
                AltiumScene3dExternalPlacementAdapter.#distanceToBody(
                    placement,
                    exactComponent
                ) <=
                    AltiumScene3dExternalPlacementAdapter
                        .#EXACT_ANCHOR_TOLERANCE_MIL)
        const isFarCurrentOwner =
            currentComponent &&
            currentDistance >
                AltiumScene3dExternalPlacementAdapter.#FAR_OWNER_DISTANCE_MIL
        const metadataComponent =
            !exactComponent && (!currentComponent || isFarCurrentOwner)
                ? AltiumScene3dExternalPlacementAdapter.#resolveMetadataComponent(
                      placement,
                      componentBody,
                      components
                  )
                : null

        if (
            isFarCurrentOwner &&
            !exactComponent &&
            !metadataComponent &&
            !AltiumScene3dExternalPlacementAdapter.#hasMetadataAffinity(
                placement,
                componentBody,
                currentComponent
            )
        ) {
            return null
        }

        const resolvedComponent =
            exactComponent || metadataComponent || currentComponent
        const mountSide = resolvedComponent
            ? AltiumScene3dExternalPlacementAdapter.#resolveComponentMountSide(
                  resolvedComponent
              ) || placement.mountSide
            : placement.mountSide
        const nextPlacement =
            exactComponent || metadataComponent
                ? {
                      ...placement,
                      designator: String(
                          resolvedComponent?.designator || placement.designator
                      ),
                      mountSide,
                      positionMil: {
                          ...placement.positionMil,
                          z: AltiumScene3dExternalPlacementAdapter.#resolveFaceZ(
                              mountSide,
                              board
                          )
                      }
                  }
                : placement

        const repairedPlacement =
            AltiumScene3dExternalPlacementAdapter.#repairRotation(
                nextPlacement,
                resolvedComponent,
                componentBody,
                Boolean(metadataComponent && !exactComponent),
                AltiumScene3dExternalPlacementAdapter.#needsPinOneYawCorrection(
                    nextPlacement,
                    resolvedComponent,
                    componentBody,
                    isExactAnchoredOwner
                ) ||
                    AltiumScene3dExternalPlacementAdapter.#needsTiltedEdgeYawCorrection(
                        nextPlacement,
                        resolvedComponent,
                        componentBody
                    )
            )

        return AltiumScene3dExternalPlacementAdapter.#withContactPadHints(
            repairedPlacement,
            resolvedComponent,
            pads,
            board
        )
    }

    /**
     * Adds pad contact hints for mixed SMT/mechanical connector footprints
     * whose embedded body was recovered from metadata rather than a footprint
     * anchor.
     * @param {object} placement External model placement.
     * @param {object | null | undefined} component Owning component.
     * @param {object[]} pads Source PCB pads.
     * @param {object} board Scene board metadata.
     * @returns {object}
     */
    static #withContactPadHints(placement, component, pads, board) {
        const contactPads =
            AltiumScene3dExternalPlacementAdapter.#resolveContactPads(
                placement,
                component,
                pads,
                board
            )
        if (!contactPads.length) {
            return placement
        }

        return {
            ...placement,
            modelTransform: {
                ...(placement?.modelTransform || {}),
                contactPadsMil: contactPads
            }
        }
    }

    /**
     * Resolves board-local SMT pad centers for mixed connector footprints.
     * @param {object} placement External model placement.
     * @param {object | null | undefined} component Owning component.
     * @param {object[]} pads Source PCB pads.
     * @param {object} board Scene board metadata.
     * @returns {{ x: number, y: number, width: number, depth: number }[]}
     */
    static #resolveContactPads(placement, component, pads, board) {
        if (
            !component ||
            String(placement?.mountSide || '').toLowerCase() !== 'top' ||
            String(placement?.projection?.source || '') !==
                'model-anchor-fallback'
        ) {
            return []
        }

        const componentPads =
            AltiumScene3dExternalPlacementAdapter.#componentPads(
                component,
                pads
            )
        const surfacePads = componentPads.filter((pad) =>
            AltiumScene3dExternalPlacementAdapter.#isTopSurfacePad(pad)
        )
        const mechanicalPads = componentPads.filter((pad) =>
            AltiumScene3dExternalPlacementAdapter.#isMechanicalAnchorPad(pad)
        )
        if (surfacePads.length < 2 || !mechanicalPads.length) {
            return []
        }

        const centerX = Number(board?.centerX || 0)
        const centerY = Number(board?.centerY || 0)

        return surfacePads
            .map((pad) => ({
                x: Number(pad?.x || 0) - centerX,
                y: Number(pad?.y || 0) - centerY,
                width: Number(pad?.sizeTopX || pad?.sizeMidX || 0),
                depth: Number(pad?.sizeTopY || pad?.sizeMidY || 0)
            }))
            .filter(
                (pad) =>
                    Number.isFinite(pad.x) &&
                    Number.isFinite(pad.y) &&
                    pad.width > 0 &&
                    pad.depth > 0
            )
    }

    /**
     * Returns pads owned by one component index.
     * @param {object} component Owning component.
     * @param {object[]} pads Source PCB pads.
     * @returns {object[]}
     */
    static #componentPads(component, pads) {
        const componentIndex = Number(component?.componentIndex)
        if (!Number.isFinite(componentIndex)) {
            return []
        }

        return (Array.isArray(pads) ? pads : []).filter(
            (pad) => Number(pad?.componentIndex) === componentIndex
        )
    }

    /**
     * Checks whether a pad exposes top paste and should be soldered on the
     * top face.
     * @param {object} pad Source PCB pad.
     * @returns {boolean}
     */
    static #isTopSurfacePad(pad) {
        return (
            Boolean(pad?.hasTopPasteMaskOpening) &&
            Number(pad?.sizeTopX || 0) > 0 &&
            Number(pad?.sizeTopY || 0) > 0
        )
    }

    /**
     * Checks whether a pad is a non-paste mechanical lock or guide.
     * @param {object} pad Source PCB pad.
     * @returns {boolean}
     */
    static #isMechanicalAnchorPad(pad) {
        return (
            !pad?.hasTopPasteMaskOpening &&
            (Number(pad?.holeSize || 0) > 0 ||
                Number(pad?.holeShape || 0) > 0 ||
                Number(pad?.layerCode || 0) > 16)
        )
    }

    /**
     * Detects top-side edge connectors whose tilted model frame points inward
     * unless the authored board-facing yaw is reversed.
     * @param {object} placement External model placement.
     * @param {object | null | undefined} component Owning component.
     * @param {object | null} componentBody Source component body.
     * @returns {boolean}
     */
    static #needsTiltedEdgeYawCorrection(placement, component, componentBody) {
        if (
            !component ||
            String(placement?.mountSide || '').toLowerCase() !== 'top' ||
            !AltiumScene3dExternalPlacementAdapter.#hasInEnvelopeNegativeStandoff(
                componentBody
            ) ||
            !AltiumScene3dExternalPlacementAdapter.#hasRightAngleModelTilt(
                componentBody
            )
        ) {
            return false
        }

        const identityText =
            AltiumScene3dExternalPlacementAdapter.#packageIdentityText(
                component,
                componentBody
            )

        return (
            AltiumScene3dExternalPlacementAdapter.#edgeConnectorTokenCount(
                identityText
            ) >= 2
        )
    }

    /**
     * Counts generic edge-connector identity tokens in package metadata.
     * @param {string} identityText Package metadata text.
     * @returns {number}
     */
    static #edgeConnectorTokenCount(identityText) {
        return new Set(
            String(identityText || '')
                .split(/[^a-zA-Z0-9]+/g)
                .map((token) => token.toLowerCase())
                .filter((token) =>
                    AltiumScene3dExternalPlacementAdapter.#EDGE_CONNECTOR_TOKENS.has(
                        token
                    )
                )
        ).size
    }

    /**
     * Resolves an anchor component only when the current owner is not close.
     * @param {object} placement External model placement.
     * @param {object | undefined} currentComponent Current matched component.
     * @param {object[]} components PCB components.
     * @returns {object | null}
     */
    static #resolveAnchorComponent(placement, currentComponent, components) {
        const currentDistance = currentComponent
            ? AltiumScene3dExternalPlacementAdapter.#distanceToBody(
                  placement,
                  currentComponent
              )
            : Number.POSITIVE_INFINITY
        if (
            currentComponent &&
            currentDistance <=
                AltiumScene3dExternalPlacementAdapter
                    .#EXACT_ANCHOR_TOLERANCE_MIL
        ) {
            return null
        }

        const exactComponent =
            AltiumScene3dExternalPlacementAdapter.#nearestAnchorComponent(
                placement,
                components,
                AltiumScene3dExternalPlacementAdapter
                    .#EXACT_ANCHOR_TOLERANCE_MIL
            )
        if (exactComponent) {
            return exactComponent
        }

        if (
            currentDistance <=
            AltiumScene3dExternalPlacementAdapter.#FAR_OWNER_DISTANCE_MIL
        ) {
            return null
        }

        return AltiumScene3dExternalPlacementAdapter.#nearestAnchorComponent(
            placement,
            components,
            AltiumScene3dExternalPlacementAdapter.#NEAR_ANCHOR_TOLERANCE_MIL
        )
    }

    /**
     * Repairs orientation fields once a source body and owner are known.
     * @param {object} placement External model placement.
     * @param {object | null | undefined} component Owning component.
     * @param {object | null} componentBody Source component body.
     * @param {boolean} useComponentYaw Whether component yaw should override body yaw.
     * @param {boolean} correctPinOneYaw Whether a square IC pin-one correction applies.
     * @returns {object}
     */
    static #repairRotation(
        placement,
        component,
        componentBody,
        useComponentYaw,
        correctPinOneYaw
    ) {
        const modelTransform =
            AltiumScene3dExternalPlacementAdapter.#repairModelTransform(
                placement?.modelTransform,
                componentBody
            )
        const isGenericPassiveBody =
            AltiumScene3dExternalPlacementAdapter.#isGenericPassiveBody(
                componentBody
            )
        if (!component || !useComponentYaw || isGenericPassiveBody) {
            const rotationDeg =
                correctPinOneYaw && !isGenericPassiveBody
                    ? AltiumScene3dExternalPlacementAdapter.#normalizeAngle(
                          Number(placement?.rotationDeg || 0) + 180
                      )
                    : placement.rotationDeg

            return {
                ...placement,
                rotationDeg,
                modelTransform
            }
        }

        return {
            ...placement,
            rotationDeg: AltiumScene3dExternalPlacementAdapter.#normalizeAngle(
                Number(component?.rotation || 0)
            ),
            modelTransform
        }
    }

    /**
     * Finds the nearest component whose anchor is effectively the body anchor.
     * @param {object} placement External model placement.
     * @param {object[]} components PCB components.
     * @returns {object | null}
     */
    static #nearestAnchorComponent(placement, components, toleranceMil) {
        const candidates = components
            .map((component) => ({
                component,
                distance: AltiumScene3dExternalPlacementAdapter.#distanceToBody(
                    placement,
                    component
                )
            }))
            .filter((candidate) => candidate.distance <= toleranceMil)
            .sort((left, right) => left.distance - right.distance)

        return candidates[0]?.component || null
    }

    /**
     * Checks whether a body has an intentional negative standoff within its own
     * height envelope.
     * @param {object | null} componentBody Source component body.
     * @returns {boolean}
     */
    static #hasInEnvelopeNegativeStandoff(componentBody) {
        const standoff = Number(
            componentBody?.standoffHeightMil ?? componentBody?.dzMil
        )
        const overallHeight = Number(componentBody?.overallHeightMil)

        return (
            Number.isFinite(standoff) &&
            Number.isFinite(overallHeight) &&
            standoff < 0 &&
            overallHeight > 0 &&
            Math.abs(standoff) < overallHeight
        )
    }

    /**
     * Checks whether the source model is laid over with a right-angle local
     * model tilt.
     * @param {object | null} componentBody Source component body.
     * @returns {boolean}
     */
    static #hasRightAngleModelTilt(componentBody) {
        const angle = AltiumScene3dExternalPlacementAdapter.#normalizeAngle(
            Number(componentBody?.modelRotationDeg?.x || 0)
        )

        return angle === 90 || angle === 270
    }

    /**
     * Detects exact top-side square IC packages whose embedded body source
     * frame places the pin-one marker opposite the rendered Altium footprint.
     * @param {object} placement External model placement.
     * @param {object | null | undefined} component Owning component.
     * @param {object | null} componentBody Source component body.
     * @param {boolean} isExactAnchoredOwner Whether the model sits on its owner anchor.
     * @returns {boolean}
     */
    static #needsPinOneYawCorrection(
        placement,
        component,
        componentBody,
        isExactAnchoredOwner
    ) {
        if (
            !isExactAnchoredOwner ||
            !component ||
            String(placement?.mountSide || '').toLowerCase() !== 'top' ||
            AltiumScene3dExternalPlacementAdapter.#isGenericPassiveBody(
                componentBody
            )
        ) {
            return false
        }

        return AltiumScene3dExternalPlacementAdapter.#PIN_ONE_CORNER_PACKAGE_PATTERN.test(
            AltiumScene3dExternalPlacementAdapter.#packageIdentityText(
                component,
                componentBody
            )
        )
    }

    /**
     * Builds package metadata text for generic package-family checks.
     * @param {object} component PCB component.
     * @param {object | null} componentBody Source component body.
     * @returns {string}
     */
    static #packageIdentityText(component, componentBody) {
        const parameterValues = Object.values(component?.parameters || {})
            .map((value) => String(value || ''))
            .join(' ')

        return [
            component?.pattern,
            component?.source,
            component?.description,
            component?.provenance?.footprintDescription,
            parameterValues,
            componentBody?.identifier,
            componentBody?.name
        ]
            .map((value) => String(value || ''))
            .join(' ')
    }

    /**
     * Matches a standalone offset body back to a component from metadata.
     * @param {object} placement External model placement.
     * @param {object | null} componentBody Source component body.
     * @param {object[]} components PCB components.
     * @returns {object | null}
     */
    static #resolveMetadataComponent(placement, componentBody, components) {
        const tokens =
            AltiumScene3dExternalPlacementAdapter.#bodyIdentityTokens(
                placement,
                componentBody
            )
        if (!tokens.length) {
            return null
        }

        const candidates = components
            .map((component) => ({
                component,
                score: AltiumScene3dExternalPlacementAdapter.#metadataScore(
                    tokens,
                    component
                ),
                distance: AltiumScene3dExternalPlacementAdapter.#distanceToBody(
                    placement,
                    component
                )
            }))
            .filter((candidate) => candidate.score > 0)
            .sort(
                (left, right) =>
                    right.score - left.score || left.distance - right.distance
            )

        return candidates[0]?.component || null
    }

    /**
     * Checks whether a weak far owner is still supported by source metadata.
     * @param {object} placement External model placement.
     * @param {object | null} componentBody Source component body.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #hasMetadataAffinity(placement, componentBody, component) {
        const tokens =
            AltiumScene3dExternalPlacementAdapter.#bodyIdentityTokens(
                placement,
                componentBody
            )

        return (
            tokens.length > 0 &&
            AltiumScene3dExternalPlacementAdapter.#metadataScore(
                tokens,
                component
            ) > 0
        )
    }

    /**
     * Scores one component against body identity tokens.
     * @param {string[]} tokens Body identity tokens.
     * @param {object} component PCB component.
     * @returns {number}
     */
    static #metadataScore(tokens, component) {
        const haystack =
            AltiumScene3dExternalPlacementAdapter.#metadataHaystack(component)

        return tokens.reduce(
            (score, token) =>
                score + (haystack.includes(token) ? token.length : 0),
            0
        )
    }

    /**
     * Builds searchable component metadata text.
     * @param {object} component PCB component.
     * @returns {string}
     */
    static #metadataHaystack(component) {
        const parameterValues = Object.values(component?.parameters || {})
            .map((value) => String(value || ''))
            .join(' ')

        return AltiumScene3dExternalPlacementAdapter.#normalizeIdentityText([
            component?.designator,
            component?.pattern,
            component?.source,
            component?.modelPath,
            parameterValues
        ])
    }

    /**
     * Collects body identity tokens suitable for exact metadata matching.
     * @param {object} placement External model placement.
     * @param {object | null} componentBody Source component body.
     * @returns {string[]}
     */
    static #bodyIdentityTokens(placement, componentBody) {
        const text = [
            placement?.designator,
            placement?.externalModel?.name,
            placement?.externalModel?.relativePath,
            componentBody?.identifier,
            componentBody?.name
        ]
            .map((value) =>
                String(value || '')
                    .replace(/\.[^.]+$/, '')
                    .trim()
            )
            .filter(Boolean)

        return [
            ...new Set(
                text.flatMap((value) =>
                    AltiumScene3dExternalPlacementAdapter.#identityTokensForText(
                        value
                    )
                )
            )
        ]
    }

    /**
     * Creates both full and delimiter-split identity tokens from one source.
     * @param {string} value Source text.
     * @returns {string[]}
     */
    static #identityTokensForText(value) {
        const baseText = String(value || '')
            .replace(/\.[^.]+$/, '')
            .trim()
        const fullToken =
            AltiumScene3dExternalPlacementAdapter.#normalizeIdentityText([
                baseText
            ])
        const partTokens = baseText
            .split(/[^a-zA-Z0-9]+/g)
            .map((part) =>
                AltiumScene3dExternalPlacementAdapter.#normalizeIdentityText([
                    part
                ])
            )

        return [fullToken, ...partTokens].filter((token) =>
            AltiumScene3dExternalPlacementAdapter.#isMeaningfulIdentityToken(
                token
            )
        )
    }

    /**
     * Checks whether one identity token is strong enough for metadata matching.
     * @param {string} token Normalized token.
     * @returns {boolean}
     */
    static #isMeaningfulIdentityToken(token) {
        return (
            token.length >= 6 &&
            !AltiumScene3dExternalPlacementAdapter.#GENERIC_IDENTITY_TOKENS.has(
                token
            )
        )
    }

    /**
     * Resolves the source component body row for one placement.
     * @param {object} placement External model placement.
     * @param {object[]} componentBodies Source component body rows.
     * @returns {object | null}
     */
    static #resolveComponentBody(placement, componentBodies) {
        const candidates = componentBodies
            .map((componentBody) => ({
                componentBody,
                distance:
                    AltiumScene3dExternalPlacementAdapter.#distanceBetweenPoints(
                        placement?.bodyPositionMil,
                        componentBody?.positionMil
                    ),
                identityScore:
                    AltiumScene3dExternalPlacementAdapter.#bodyPlacementIdentityScore(
                        placement,
                        componentBody
                    )
            }))
            .filter((candidate) => candidate.distance <= 0.01)
            .sort(
                (left, right) =>
                    right.identityScore - left.identityScore ||
                    left.distance - right.distance
            )

        return candidates[0]?.componentBody || null
    }

    /**
     * Scores whether a source body row belongs to one placement.
     * @param {object} placement External model placement.
     * @param {object} componentBody Source component body.
     * @returns {number}
     */
    static #bodyPlacementIdentityScore(placement, componentBody) {
        const placementText =
            AltiumScene3dExternalPlacementAdapter.#normalizeIdentityText([
                placement?.designator,
                placement?.externalModel?.name
            ])
        const bodyText =
            AltiumScene3dExternalPlacementAdapter.#normalizeIdentityText([
                componentBody?.identifier,
                componentBody?.name
            ])

        return placementText && bodyText && placementText.includes(bodyText)
            ? bodyText.length
            : 0
    }

    /**
     * Repairs model-local Altium rotation signs for embedded body transforms.
     * @param {object | null | undefined} modelTransform Placement transform.
     * @param {object | null} componentBody Source component body.
     * @returns {object | null | undefined}
     */
    static #repairModelTransform(modelTransform, componentBody) {
        const rotationDeg = modelTransform?.rotationDeg || {}
        const repairedTransform = {
            ...(modelTransform || {}),
            dzMil: AltiumScene3dExternalPlacementAdapter.#repairVerticalOffset(
                modelTransform,
                componentBody
            )
        }
        if (modelTransform?.offsetMil) {
            repairedTransform.offsetMil = {
                ...modelTransform.offsetMil,
                z: repairedTransform.dzMil
            }
        }

        return {
            ...repairedTransform,
            rotationDeg: {
                ...rotationDeg,
                x: Number(rotationDeg.x ?? 0),
                y: Number(rotationDeg.y ?? 0),
                z: Number(rotationDeg.z ?? 0)
            }
        }
    }

    /**
     * Clamps only negative standoffs that exceed the source model's height
     * envelope and would sink a seated STEP model through the PCB face.
     * @param {object | null | undefined} modelTransform Placement transform.
     * @param {object | null} componentBody Source component body.
     * @returns {number}
     */
    static #repairVerticalOffset(modelTransform, componentBody) {
        const offsetMil = modelTransform?.offsetMil || {}
        const value = Number(offsetMil.z ?? modelTransform?.dzMil ?? 0)
        if (!Number.isFinite(value)) {
            return 0
        }

        if (value >= 0) {
            return value
        }

        const overallHeight = Number(componentBody?.overallHeightMil || 0)
        if (overallHeight > 0 && Math.abs(value) < overallHeight) {
            return value
        }

        return 0
    }

    /**
     * Checks whether a body is a generic passive package where body yaw is safe.
     * @param {object | null} componentBody Source component body.
     * @returns {boolean}
     */
    static #isGenericPassiveBody(componentBody) {
        return AltiumScene3dExternalPlacementAdapter.#PASSIVE_BODY_PATTERN.test(
            [componentBody?.identifier, componentBody?.name].join(' ')
        )
    }

    /**
     * Measures the XY distance between one body anchor and one component.
     * @param {object} placement External model placement.
     * @param {object} component PCB component.
     * @returns {number}
     */
    static #distanceToBody(placement, component) {
        return AltiumScene3dExternalPlacementAdapter.#distanceBetweenPoints(
            { x: component?.x, y: component?.y },
            placement?.bodyPositionMil
        )
    }

    /**
     * Measures the XY distance between two points.
     * @param {{ x?: number, y?: number } | null | undefined} first First point.
     * @param {{ x?: number, y?: number } | null | undefined} second Second point.
     * @returns {number}
     */
    static #distanceBetweenPoints(first, second) {
        return Math.hypot(
            Number(first?.x || 0) - Number(second?.x || 0),
            Number(first?.y || 0) - Number(second?.y || 0)
        )
    }

    /**
     * Resolves one component's board side from its layer.
     * @param {object} component PCB component.
     * @returns {'top' | 'bottom' | null}
     */
    static #resolveComponentMountSide(component) {
        const layer = String(component?.layer || '').toUpperCase()
        if (layer.includes('BOTTOM') || layer === 'BOT') {
            return 'bottom'
        }

        if (layer.includes('TOP')) {
            return 'top'
        }

        return null
    }

    /**
     * Resolves the board face Z coordinate for one mount side.
     * @param {string} mountSide Mount side.
     * @param {object} board Scene board metadata.
     * @returns {number}
     */
    static #resolveFaceZ(mountSide, board) {
        const thickness =
            Number(board?.thicknessMil) ||
            AltiumScene3dExternalPlacementAdapter.#DEFAULT_BOARD_THICKNESS_MIL
        const halfThickness = thickness / 2

        return String(mountSide || '').toLowerCase() === 'bottom'
            ? -halfThickness
            : halfThickness
    }

    /**
     * Normalizes one angle into [0, 360).
     * @param {number} angle Source angle.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const normalized = Number(angle || 0) % 360

        return normalized < 0 ? normalized + 360 : normalized
    }

    /**
     * Normalizes identity strings for exact substring matching.
     * @param {unknown[]} values Source values.
     * @returns {string}
     */
    static #normalizeIdentityText(values) {
        return values
            .map((value) => String(value || '').toLowerCase())
            .join(' ')
            .replace(/\.[a-z0-9]+\\b/g, '')
            .replace(/[^a-z0-9]+/g, '')
    }
}
