def sombra_mind_state(promptString, OpenAIClient):
    # prompt = ''
    with open('Sombra/prompts/sombraCurriculum.md', 'r') as promptFile:
        prompt = promptFile.read()

    print('[SOMBRA] Calling OpenAI backend')

    response = OpenAIClient.chat.completions.create(
        # model="gpt-4-1106-preview",
        model="gpt-3.5-turbo-1106",
        messages=[
            {
                "role": "system",
                "content": prompt
            },
            {
                "role": "user",
                "content": promptString
            }
        ],
        temperature=0.2,
        max_tokens=1500,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0
    )

    return response.choices[0].message.content


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

    response = OpenAIClient.chat.completions.create(
        model="gpt-4-1106-preview",
        messages=[
            {
                "role": "system",
                "content": prompt
            },
            {
                "role": "user",
                "content": generatedMindState
            }
        ],
        temperature=1,
        max_tokens=1500,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0
    )

    instructions = response.choices[0].message.content
    return '\n'.join(generatedMindState.splitlines()[-2:]), instructions


def call_ego(promptString, OpenAIClient):
    # prompt = ''
    with open('Sombra/prompts/anyInABottle.md', 'r') as promptFile:
        prompt = promptFile.read()

    print('[EGO] Calling OpenAI backend')

    response = OpenAIClient.chat.completions.create(
        # model="gpt-3.5-turbo-1106",
        model="gpt-4-1106-preview",
        messages=[
            {
                "role": "system",
                "content": prompt
            },
            {
                "role": "user",
                "content": promptString
            }
        ],
        temperature=0.75,
        max_tokens=500,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0
    )

    anyChat = response.choices[0].message.content
    return anyChat
