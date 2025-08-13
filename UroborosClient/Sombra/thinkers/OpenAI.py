def sombra_mind_state(promptString, OpenAIClient):
    # prompt = ''
    with open('Sombra/prompts/sombraCurriculum.md', 'r') as promptFile:
        prompt = promptFile.read()

    print('[SOMBRA] Calling OpenAI backend')

    response = OpenAIClient.responses.create(
        model="gpt-4-1106-preview",
        input=[
            {
                "role": "developer",
                "content": [
                    {
                        "type": "input_text",
                        "text": prompt
                    }
                ]
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": promptString
                    }
                ]
            }
        ],
        temperature=0.2,
        store=True
    )

    return response.output_text


def executive_function(promptString, OpenAIClient):
    # prompt = ''
    with open('Sombra/prompts/Puppeteer.md', 'r') as promptFile:
        prompt = promptFile.read()

    generatedMindState = sombra_mind_state(promptString, OpenAIClient)

    stateStart = promptString.find('Bioma:')
    stateString = '\n'.join(promptString[stateStart:].splitlines()[:-2])

    t = stateString + '\n' + generatedMindState
    generatedMindState = "".join([s for s in t.strip().splitlines(True) if s.strip()])

    print('[GULLIVER] Calling OpenAI backend')

    response = OpenAIClient.responses.create(
        model="gpt-4-1106-preview",
        input=[
            {
                "role": "developer",
                "content": [
                    {
                        "type": "input_text",
                        "text": prompt
                    }
                ]
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": generatedMindState
                    }
                ]
            }
        ],
        temperature=1,
        store=True
    )

    instructions = response.output_text
    reason_start = generatedMindState.find('Razonamiento')
    return '\n'.join(generatedMindState[reason_start:].splitlines()[0:]), instructions


def call_ego(promptString, OpenAIClient):
    # prompt = ''
    with open('Sombra/prompts/anyInABottle.md', 'r') as promptFile:
        prompt = promptFile.read()

    print('[EGO] Calling OpenAI backend')

    response = OpenAIClient.responses.create(
        model="gpt-4-1106-preview",
        input=[
            {
                "role": "developer",
                "content": [
                    {
                        "type": "input_text",
                        "text": prompt
                    }
                ]
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": promptString
                    }
                ]
            }
        ],
        temperature=0.75,
        store=True
    )

    anyChat = response.output_text
    return anyChat
